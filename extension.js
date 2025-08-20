const version = "1.2.0";
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Utils from './utils.js';


let pwCalc;
let uuid;
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;
const PRIMARY_TYPE = St.ClipboardType.PRIMARY;
const RECENT_URL_KEY = 'recenturls';
const SHOW_COPY_NOTIFICATION_KEY = 'show-copy-notification';
const COPY_TO_CLIPBOARD_KEY = 'copy-to-clipboard';
const COPY_TO_PRIMARY_KEY = 'copy-to-primary-selection';
const KEEP_COPY_OF_ALIASES_IN_FILE_KEY = 'keep-copy-of-aliases-in-file';
const KEEP_COPY_OF_ALIASES_FILENAME_KEY = 'keep-copy-of-aliases-filename';
const DEFAULT_PASSWORD_LENGTH_KEY = 'default-password-length';
const PASSWORD_METHOD_KEY = 'password-method';
const LAST_VERSION_KEY = 'last-version';


export default class pwcalcExtension extends Extension {

	//Consider this method deprecated. Only specify gettext-domain in metadata.json. GNOME Shell can automatically initiate the translation for you when it sees the gettext-domain key in metadata.json.
	//ExtensionUtils.initTranslations(this.uuid);

	enable() {
		this._settings = this.getSettings();
		uuid = this.uuid;
		validate_pw_calculation();
		pwCalc = new PasswordCalculator(this._settings, this);
		Main.panel.addToStatusArea('pwCalc', pwCalc);
	}

	disable() {
		pwCalc.destroy();
		pwCalc = null;
		this._settings = null;
	}
}

let RecentAliasMenuItem = GObject.registerClass({
	Signals: {
		'select': {}
	}
}, class RecentAliasMenuItem extends PopupMenu.PopupBaseMenuItem {
	_init(text, params) {
		super._init(params);
		this.label = new St.Label({ text: text });
		this.add_child(this.label);
	}
	activate(event) {
		this._parent.close(true);
		this.emit('select');
	}
});

let SuggestionMenuItem = GObject.registerClass({
	Signals: {
		'select': {}
	}
}, class SuggestionMenuItem extends PopupMenu.PopupBaseMenuItem {
	_init(text, params) {
		super._init(params);
		this.label = new St.Label({ text: text });
		this.add_child(this.label);
	}
	activate(event) {
		this.emit('select');
	}
});

let PasswordCalculator = GObject.registerClass(
	class PasswordCalculator extends PanelMenu.Button {
		_init(_settings, ext) {
			super._init(0, 'PasswordCalculator', false);
			this.settings = _settings;
			this.ext = ext;
			this.suggestionsItems = [];
			this.loadConfig();
			this.compat_password_method();
			this.setupUI();
			this.updateRecentURL();
		}
		setupUI() {

			this.iconActor = new St.Icon({ icon_name: 'dialog-password-symbolic', style_class: 'system-status-icon' });
			this.add_child(this.iconActor);

			let topSection = new PopupMenu.PopupMenuSection();
			let bottomSection = new PopupMenu.PopupMenuSection();
			this.headingLabel = new St.Label({ text: _("Password Calculator"), style_class: "heading", can_focus: false });

			this.urlCombo = new PopupMenu.PopupSubMenuMenuItem("");

			this.urlText = new St.Entry({
				name: "searchEntry",
				hint_text: _("alias"),
				track_hover: true,
				can_focus: true,
				style_class: "search-entry first"
			});

			let self = this;
			this.urlText.clutter_text.connect('key-release-event', function (o, e) {
				self.urlChanged.apply(self, [o, e]);
			});

			this.secretText = new St.Entry({
				name: "searchEntry",
				hint_text: _("secret"),
				track_hover: true,
				can_focus: true,
				style_class: "search-entry last"
			});

			this.secretText.clutter_text.connect('text-changed', function (o, e) {
				self.updatePasswordDisplay();
			});

			this.secretText.clutter_text.connect('key-press-event', function (o, e) {
				if (e.get_key_symbol() === Clutter.KEY_Return) {
					self.handoverPassword();
					return Clutter.EVENT_STOP;
				}
				return Clutter.EVENT_PROPAGATE;
			});

			this.pwdText = new St.Label({ style_class: "pwd", can_focus: false });
			topSection.box.add_child(this.headingLabel);
			topSection.box.add_child(this.urlText);
			bottomSection.box.add_child(this.secretText);
			bottomSection.box.add_child(this.pwdText);
			topSection.box.add_style_class_name("pwCalc");
			bottomSection.box.add_style_class_name("pwCalc");
			this.menu.addMenuItem(topSection);
			this.menu.addMenuItem(bottomSection);
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			this.menu.addMenuItem(this.urlCombo);

			let item = new PopupMenu.PopupMenuItem(_("Settings"));
			item.connect('activate', function (sender, open) {
				self.ext.openPreferences();
			});

			this.menu.addMenuItem(item);

			this.menu.connect('open-state-changed', function (sender, open) {
				self.clear();
				if (!open) self.urlText.clutter_text.grab_key_focus();
			});
		}

		compat_password_method() {
			let type = this.PasswordMethod;
			let keys = this.recentURL;
			if (this.LastVersion == "undefined" && type == "HMAC_SHA1") {
				this.PasswordMethod = "HMAC_SHA1_INEXACT";
				console.info(uuid + ": Setting password-method to HMC-SHA1_INEXACT, since it is the previously used method.");
			} else if (type == "__compat__") {
				if (keys.length > 0) {
					this.PasswordMethod = "SHA1";
					console.info(uuid + ": Initializing password-method to SHA1 due to preexisting aliases");
				} else {
					this.PasswordMethod = "HMAC_SHA1";
				}
			}
			this.LastVersion = version;
		}

		urlChanged(o, e) {
			this.updatePasswordDisplay();
			const typed = this.urlText.get_text();
			let urls = this.recentURL
				.filter(entry => Array.isArray(entry) && typeof entry[0] === 'string')
				.map(entry => entry[0])
				.filter(alias => alias.toLowerCase().includes(typed.toLowerCase()));

			this.updateSuggestions(urls);

			// Return key: move focus only
			if (e.get_key_symbol() === Clutter.KEY_Return) {
				this.secretText.clutter_text.grab_key_focus();

				// Clear autocomplete suggestions
				this.updateSuggestions();
				return Clutter.EVENT_STOP;
			}

			return Clutter.EVENT_PROPAGATE;
		}

		handoverPassword() {
			let url = this.urlText.get_text().trim();
			this.addRecentURL(url);
			let pwd = this.generatePassword();
			if (pwd)
				this.copyAndSendNotification(pwd, url);
			global.stage.set_key_focus(null);
			GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
				this.menu.close();
				return GLib.SOURCE_REMOVE;
			});
		}

		updatePasswordDisplay() {
			let pwd = this.generatePassword();
			let txt = _("your password");
			if (pwd)
				txt = this.obfuscate(pwd)
			this.pwdText.set_text(txt);
		}

		generatePassword() {
			let url = this.urlText.get_text().trim();
			let sec = this.secretText.get_text().trim();
			if (url && sec) {
				let len = this.DefaultPasswordLength;
				let entry = this.recentURL.find(entry => entry[0] === url);
				if (entry) {
					let len = entry[1];
					if (len == "default") len = this.DefaultPasswordLength;
				}
				let type = this.PasswordMethod;
				let calc = calculatePassword[type];
				if (!calc) {
					log("Error: Unknown password-calculation method:",type);
					return;
				}
				let pwd = calc(sec, url, len);
				return pwd;
			} else
				return null;
		}

		obfuscate(text) {
			let len = text.length;
			let showcount;
			if (len <= 8) showcount = 1;
			else if (len <= 12) showcount = 2;
			else if (len <= 16) showcount = 3;
			else showcount = 4;
			return text.substring(0, showcount) + Array(len + 1 - 2 * showcount).join("\u00B7") + text.substring(len - showcount);
		}

		addRecentURL(url) {
			let list = this.recentURL;
			if (!list.some(entry => entry[0] === url)) {
				let now = new Date().toISOString();
				list.push([url, "default", now]);
				list.sort((a, b) => a[0].localeCompare(b[0]));
				this.recentURL = list;
			}
		}

		copyAndSendNotification(pwd, url) {
			let clipboard = St.Clipboard.get_default();
			if (this.CopyToClipboard) {
				clipboard.set_text(CLIPBOARD_TYPE, pwd);
				if (this.ShowCopyNotification) showMessage(_("Password copied to clipboard."), url);
			}
			if (this.CopyToPrimarySelection) {
				clipboard.set_text(PRIMARY_TYPE, pwd);
				if (this.ShowCopyNotification) showMessage(_("Password copied to primary selection."), url);
			}
		}

		clear() {
			this.urlText.set_text("");
			this.secretText.set_text("");
			this.pwdText.set_text(_("your password"));
			this.updateSuggestions();
		}

		updateSuggestions(list) {
			this.suggestionsItems.forEach(i => this.menu.box.remove_child(i));
			this.suggestionsItems = [];

			if (list != null) {
				list = removeDuplicates(list);
				let N = Math.min(16, list.length);
				for (let i = 0; i < N; i++) {
					const alias = list[i];
					const item = new SuggestionMenuItem(alias);
					item.add_style_class_name("pwCalcSuggestion");
					this.menu.addMenuItem(item, i + 1);
					item.connect('select', () => { this.urlSelected(alias); });
					this.suggestionsItems.push(item);
				}
			}
		}

		updateRecentURL() {
			let list = this.recentURL;
			list = removeDuplicates(list.map(e => e[0])); // only use alias text for display
			this.urlCombo.menu.removeAll();
			for (let i = 0; i < list.length; i++) {
				let item = new RecentAliasMenuItem(list[i]);
				this.urlCombo.menu.addMenuItem(item, i);
				item.connect('select', () => { this.urlSelected(list[i]); });
			}
			this.urlCombo.label.set_text(list.length === 0 ? _("No Recent Aliases") : _("Recent Aliases"));
		}
		urlSelected(URL) {
			this.updateSuggestions();
			this.urlText.set_text(URL);
			this.secretText.clutter_text.grab_key_focus();
		}
		loadConfig() {
			let self = this;
			this._settingsC = this.settings.connect("changed::" + RECENT_URL_KEY, function (a, key) {
				if (self.KeepCopyOfAliasesInFile) {
					let fn = self.KeepCopyOfAliasesFilename;
					let json = JSON.stringify(self.recentURL, null, "\t");
					let success = GLib.file_set_contents(fn, json + "\n");
					if (success == false) console.error(uuid + ": Unable to write to file " + fn);
				}
			});
		}
		get recentURL() {
			var js = this.getString(RECENT_URL_KEY);
			var arr;
			try {
				arr = JSON.parse(js);
			} catch (e) {
				arr = [];
			}
			return arr.map(entry => Array.isArray(entry) ? entry : [entry, "default", ""])
		}
		set recentURL(v) {
			var json = JSON.stringify(v);
			if (json !== this.getString(RECENT_URL_KEY)) {
				this.settings.set_string(RECENT_URL_KEY, json);
				this.updateRecentURL();
			}
		}
		getBool(key) {
			return this.settings.get_boolean(key);
		}
		getInteger(key) {
			return this.settings.get_int(key);
		}
		getString(key) {
			return this.settings.get_string(key);
		}
		setString(key, value) {
			return this.settings.set_string(key, value);
		}
		get ShowCopyNotification() {
			return this.getBool(SHOW_COPY_NOTIFICATION_KEY);
		}
		get CopyToClipboard() {
			return this.getBool(COPY_TO_CLIPBOARD_KEY);
		}
		get CopyToPrimarySelection() {
			return this.getBool(COPY_TO_PRIMARY_KEY);
		}
		get DefaultPasswordLength() {
			return this.getInteger(DEFAULT_PASSWORD_LENGTH_KEY);
		}
		get LastVersion() {
			return this.getString(LAST_VERSION_KEY);
		}
		set LastVersion(v) {
			return this.setString(LAST_VERSION_KEY, v);
		}
		get PasswordMethod() {
			return this.getString(PASSWORD_METHOD_KEY);
		}
		set PasswordMethod(v) {
			return this.setString(PASSWORD_METHOD_KEY, v);
		}
		get KeepCopyOfAliasesInFile() {
			return this.getBool(KEEP_COPY_OF_ALIASES_IN_FILE_KEY);
		}
		get KeepCopyOfAliasesFilename() {
			return this.getString(KEEP_COPY_OF_ALIASES_FILENAME_KEY);
		}
	});

function removeDuplicates(a) {
	var b = {};
	for (var i = 0; i < a.length; i++)
		b[a[i]] = a[i];
	var c = [];
	for (var key in b)
		c.push(key);
	return c;
}

function showMessage(text, url) {
	let source = new MessageTray.Source({
		title: _('Password Calculator'),
		iconName: 'dialog-password-symbolic',
	});
	Main.messageTray.add(source);

	let notification = new MessageTray.Notification({
		source: source,
		title: 'Password for ' + url,
		body: text,
	});
	source.addNotification(notification);
}

function hex2bytearray(hex) {
	var array = hex.match(/.{2}/g);
	var bytes = new Uint8Array(20);
	for (var i = 0; i < array.length; i++)
		bytes[i] = parseInt(array[i], 16);
	return bytes;
}

function hex2string(hex) {
	var array = hex.match(/.{2}/g);
	var bytes = new Uint8Array(20);
	for (var i = 0; i < array.length; i++)
		bytes[i] = parseInt(array[i], 16);
	return String.fromCharCode.apply(null, bytes);
}

function string2bytearray(str) {
	var bytes = new Uint8Array(str.length);
	for (var i = 0; i < str.length; i++) {
		bytes[i] = str.charCodeAt(i);
	}
	return bytes;
}

function FilledArray(len, value) {
	var a = new Uint8Array(len);
	for (var i = 0; i < len; i++)
		a[i] = value;
	return a;
}

function sha1bytes(text) {
	var c = new GLib.Checksum(GLib.ChecksumType.SHA1);
	c.update(text);
	//return c.get_digest();
	return hex2bytearray(c.get_string());
}
function sha1string(text) {
	var c = new GLib.Checksum(GLib.ChecksumType.SHA1);
	c.update(text);
	return c.get_string();
}

function uint8array_concat(a, b) {
	return new Uint8Array([...a, ...b]);
}

var calculatePassword = {
	SHA1: function (secret, domain, length) {
		if (secret == "" || domain == "") return "";
		var text = secret + domain;
		var sha1 = sha1bytes(text);
		var base64 = GLib.base64_encode(sha1);
		return base64.substring(0, length);
	},
	HMAC_SHA1: function (secret, domain, length) {
		if (secret == "" || domain == "") return "";

		var i_key_b = FilledArray(64, 0x36);
		var o_key_b = FilledArray(64, 0x5c);
		var i, j, sha1;

		secret = string2bytearray(Utils.Utf8.encode(secret));
		domain = string2bytearray(Utils.Utf8.encode(domain));

		if (secret.length > 64)
			secret = sha1string(secret);

		for (i = 0; i < secret.length; i++) {
			i_key_b[i] ^= secret[i];
			o_key_b[i] ^= secret[i];
		}

		sha1 = sha1bytes(uint8array_concat(i_key_b, domain));
		sha1 = sha1bytes(uint8array_concat(o_key_b, sha1));
		var base64 = GLib.base64_encode(sha1);
		return base64.substring(0, length);
	},
	HMAC_SHA1_INEXACT: function (secret, domain, length) {
		if (secret == "" || domain == "") return "";

		var i_key_b = FilledArray(64, 0x36);
		var o_key_b = FilledArray(64, 0x5c);
		var i, j, sha1;

		secret = string2bytearray(Utils.Utf8.encode(secret));
		domain = string2bytearray(Utils.Utf8.encode(domain));

		if (secret.length > 64)
			secret = sha1string(secret);

		for (i = 0, j = secret.length; i < j; i += 1) {
			i_key_b[i] ^= secret[i];
			o_key_b[i] ^= secret[i];
		}
		sha1 = string2bytearray(sha1string(uint8array_concat(i_key_b, domain)));
		sha1 = sha1bytes(uint8array_concat(o_key_b, sha1));
		var base64 = GLib.base64_encode(sha1);
		return base64.substring(0, length);
	}
};

function error_pw_validation(type, ref, val) {
	if (ref != val)
		console.error(uuid + ": Test " + type + " failed: reference value is " + ref + " but calculated " + val);
	else
		console.info(uuid + ": Test " + type + " success.");
}

function validate_pw_calculation() {
	let sha1_ref = "pFWU9V+5Ns6ie+4F";
	let hmac_sha1_ref = "p2FCQnf42dGKh5JU";
	let hmac_sha1_inexact_ref = "gT7nAfjjcnOQDUIc";
	let sha1_val = calculatePassword.SHA1("secret", "domain", 16);
	let hmac_sha1_val = calculatePassword.HMAC_SHA1("secret", "domain", 16);
	let hmac_sha1_inexact_val = calculatePassword.HMAC_SHA1_INEXACT("secret", "domain", 16);
	error_pw_validation("SHA1", sha1_ref, sha1_val);
	error_pw_validation("HMAC_SHA1", hmac_sha1_ref, hmac_sha1_val);
	error_pw_validation("HMAC_SHA1_INEXACT", hmac_sha1_inexact_ref, hmac_sha1_inexact_val);
}

