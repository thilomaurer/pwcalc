const version = "1.1.5";

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Lang = imports.lang;

const {
	Gdk, Gio, GLib, GObject, Shell, St
} = imports.gi;

const Util = imports.misc.util;
const Gettext = imports.gettext;
const _ = Gettext.domain('pwCalc').gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Utils = Me.imports.utils;
const Base64 = Me.imports.base64;

let pwCalc, clipboard;
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

let RecentAliasMenuItem = GObject.registerClass({
	Signals: {
        'select': {}
    }
}, class RecentAliasMenuItem extends PopupMenu.PopupBaseMenuItem {
	_init(text, params) {
		super._init(params);
		this.label = new St.Label({ text: text });
		this.add(this.label);
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
		this.add(this.label);
	}
	activate(event) {
		this.emit('select');
	}
});

let PasswordCalculator = GObject.registerClass(
class PasswordCalculator extends PanelMenu.Button {
	_init() {
		super._init(0, 'PasswordCalculator', false);
		this.suggestionsItems=[];
		this.loadConfig();
		this.compat_password_method();
		this.setupUI();
		this.updateRecentURL();
	}
	_onPreferencesActivate() {
		Util.spawn(["gnome-shell-extension-prefs","pwcalc@thilomaurer.de"]);
		return 0;
	}
	setupUI() {

		this.iconActor = new St.Icon({ icon_name: 'dialog-password-symbolic', style_class: 'system-status-icon' });
		this.add_child(this.iconActor);

		let topSection = new PopupMenu.PopupMenuSection();
		let bottomSection = new PopupMenu.PopupMenuSection();
		this.headingLabel = new St.Label({ text:_("Password Calculator"), style_class: "heading", can_focus:false });

		this.urlCombo = new PopupMenu.PopupSubMenuMenuItem("");

		this.urlText = new St.Entry({
			name: "searchEntry",
			hint_text: _("alias"),
			track_hover: true,
			can_focus: true,
			style_class: "search-entry first"
		});

		let self=this;
		this.urlText.clutter_text.connect('key-release-event', function(o,e) {
			self.urlChanged.apply(self,[o,e]);
		});

		this.secretText = new St.Entry({
			name: "searchEntry",
			hint_text: _("secret"),
			track_hover: true,
			can_focus: true,
			style_class: "search-entry last"
		}); 
		this.secretText.clutter_text.connect('text-changed', function(o,e) {
			self.secretChanged.apply(self,[o,e]);
		});
		this.secretText.clutter_text.connect('key-release-event', function(o,e) {
			self.gen.apply(self,[o,e]);
		});
		this.pwdText = new St.Label({style_class: "pwd", can_focus:false});
		topSection.actor.add_actor(this.headingLabel);
		topSection.actor.add_actor(this.urlText);
		bottomSection.actor.add_actor(this.secretText);
		bottomSection.actor.add_actor(this.pwdText);
		topSection.actor.add_style_class_name("pwCalc");
		bottomSection.actor.add_style_class_name("pwCalc");
		this.menu.addMenuItem(topSection);
		this.menu.addMenuItem(bottomSection);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());    
		this.menu.addMenuItem(this.urlCombo);

		let item = new PopupMenu.PopupMenuItem(_("Settings"));
		item.connect('activate', Lang.bind(this, this._onPreferencesActivate));
		this.menu.addMenuItem(item);

		this.menu.connect('open-state-changed', function(sender,open) {
			self.clear();
			if (!open) self.urlText.clutter_text.grab_key_focus();
		});
	}
	secretChanged(o,e) {
		let st = this.secretText;
		let sec = st.get_text();
		let pwc='';
		if (sec!="") pwc='\u25cf'; // ● U+25CF BLACK CIRCLE
		st.clutter_text.set_password_char(pwc);
	}
	compat_password_method() {
		let type = this.PasswordMethod;
		let keys = this.recentURL;
		if (this.LastVersion == "undefined" && type == "HMAC_SHA1") {
			this.PasswordMethod = "HMAC_SHA1_INEXACT";
			global.log("Password Calculator: Setting password-method to HMC-SHA1_INEXACT, since it is the method used before.");
		} else if (type == "__compat__") {
			if (keys.length>0) {
				this.PasswordMethod = "SHA1";
				global.log("Password Calculator: Initializing password-method to SHA1 due to preexisting aliases");
			} else {
				this.PasswordMethod = "HMAC_SHA1";
			}
		}
		this.LastVersion = version;
	}
	urlChanged(o,e) {
		var urls;
		this.gen(o);
		if (e.get_key_symbol() == Gdk.KEY_Return)
			this.secretText.clutter_text.grab_key_focus();
		else {
			let url = this.urlText.get_text();
			if (url.length>0)
				urls = this.recentURL.filter(u => u.toLowerCase().indexOf(url.toLowerCase())!=-1);
		}
		this.updateSuggestions(urls);
	}
	gen(o,e) {
		let url = this.urlText.get_text();
		let sec = this.secretText.get_text();
		if ((url!="")&&(sec!="")) {
			let len = this.DefaultPasswordLength;
			let type = this.PasswordMethod;
			let calc = calculatePassword[type];
			if (calc === undefined) return;
			let pwd = calc(sec, url, len);
			this.pwdText.set_text(this.obfuscate(pwd));
			if (e && e.get_key_symbol() == Gdk.KEY_Return) {
				this.copyAndSendNotification(pwd);
				this.addRecentURL(url);
				this.menu.actor.hide();
			}
		} else {
			this.pwdText.set_text(_("your password"));
		}
	}
	obfuscate(text) {
		let len = text.length;
		let showcount;
		if (len<=8) showcount=1;
		else if (len<=12) showcount=2;
		else if (len<=16) showcount=3;
		else showcount=4;
		return text.substring(0,showcount)+Array(len+1-2*showcount).join("\u00B7")+text.substring(len-showcount);
	}
	addRecentURL(url) {
		var a=this.recentURL;
		if (a.indexOf(url)<0) {
			a.push(url);
			a.sort();
			this.recentURL=a;
		}
	}
	copyAndSendNotification(pwd) {
		if (this.CopyToClipboard) {
			clipboard.set_text(CLIPBOARD_TYPE,pwd);
			if (this.ShowCopyNotification) showMessage("Password Calculator: Password copied to clipboard.");
		}
		if (this.CopyToPrimarySelection) {
			clipboard.set_text(PRIMARY_TYPE,pwd);
			if (this.ShowCopyNotification) showMessage("Password Calculator: Password copied to primary selection.");
		}
	}
	clear() {
		this.urlText.set_text("");
		this.secretText.set_text("");
		this.pwdText.set_text(_("your password"));
		this.updateSuggestions();
	}
	updateSuggestions(list) {
		this.suggestionsItems.forEach(i=>this.menu.box.remove_child(i.actor));
		this.suggestionsItems=[];
		if (list!=null) {
			list = removeDuplicates(list);
			let N=list.length;
			if (N>8) N=8;
			for (let i=0;i<N;i++) {
				let item = new SuggestionMenuItem(list[i]);
				item.actor.add_style_class_name("pwCalcSuggestion");
				this.menu.addMenuItem(item,i+1);
				item.connect('select', Lang.bind(this, this.urlSelected, list[i]));
				this.suggestionsItems.push(item);
			}
		}
	}
	updateRecentURL() {
		let list = this.recentURL;
		list = removeDuplicates(list);
		this.urlCombo.menu.removeAll();
		for (let i=0;i<list.length;i++) {
			let item = new RecentAliasMenuItem(list[i]);
			this.urlCombo.menu.addMenuItem(item, i);
			item.connect('select', Lang.bind(this, this.urlSelected, list[i]));
		}
		let labeltext;
		if (list.length==0) labeltext=_("No Recent Aliases");
		else labeltext=_("Recent Aliases");
		this.urlCombo.label.set_text(labeltext);
	}
	urlSelected(sender,URL) {
		this.updateSuggestions();
		this.urlText.set_text(URL);
		this.secretText.clutter_text.grab_key_focus();
	}
	loadConfig() {
		this.settings = Convenience.getSettings();
		let self = this;
		this._settingsC = this.settings.connect("changed::"+RECENT_URL_KEY,function(a,key) {
			if (self.KeepCopyOfAliasesInFile) {
				let fn=self.KeepCopyOfAliasesFilename;
				let json=JSON.stringify(self.recentURL,null,"\t");
				let success=GLib.file_set_contents(fn,json+"\n");
				if (success==false) global.log("pwcalc: Unable to write to file "+fn);
			}
		});
	}
	get recentURL() {
		var js=this.getString(RECENT_URL_KEY);
		var obj;
		try {
			obj=JSON.parse(js);
		} catch(e) {
			obj=[];
		}
		return obj;
	}
	set recentURL(v)
	{
		var json=JSON.stringify(v);
		if (json!==this.getString(RECENT_URL_KEY)) {
			this.settings.set_string(RECENT_URL_KEY,json);
			this.updateRecentURL();
		}
	}
	getBool(key)
	{
		return this.settings.get_boolean(key);
	}
	getInteger(key)
	{
		return this.settings.get_int(key);
	}
	getString(key)
	{
		return this.settings.get_string(key);
	}
	setString(key,value)
	{
		return this.settings.set_string(key,value);
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
		return this.setString(LAST_VERSION_KEY,v);
	}
	get PasswordMethod() {
		return this.getString(PASSWORD_METHOD_KEY);
	}
	set PasswordMethod(v) {
		return this.setString(PASSWORD_METHOD_KEY,v);
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

function showMessage(text) { 
	let source = new MessageTray.SystemNotificationSource();
	Main.messageTray.add(source);
	let notification = new MessageTray.Notification(source, text, null);
	notification.setTransient(true);
	source.notify(notification);
}

function hex2string(hex) {
	var array = hex.match(/.{2}/g);
	var bytes = new Uint8Array(20);
	for (var i = 0; i < array.length; i++)
		bytes[i] = parseInt(array[i], 16);
	return String.fromCharCode.apply(null, bytes);
}

function FilledArray(len,value) {
	var a=new Uint8Array(len);
	for (var i=0;i<len;i++)
		a[i]=value;
	return a;
}

var calculatePassword={
	SHA1: function(secret, domain, length) {
		if (secret==""||domain=="") return "";
		var sha1 = Utils.Sha1.hash(secret + domain);
		var base64 = Base64.base64.encode(hex2string(sha1));
		return base64.substring(0, length);
	},
	HMAC_SHA1: function(secret, domain, length) {
		if (secret==""||domain=="") return "";

		var i_key_b = FilledArray(64,0x36);
		var o_key_b = FilledArray(64,0x5c);
		var i, j, sha1;

		secret = Utils.Utf8.encode(secret);
		domain = Utils.Utf8.encode(domain);

		if (secret.length > 64)
			secret = hex2string(Utils.Sha1.hash(secret, false));

		for (i = 0; i < secret.length; i++) {
			i_key_b[i] ^= secret.charCodeAt(i);
			o_key_b[i] ^= secret.charCodeAt(i);
		}
		i_key_b = String.fromCharCode.apply(null, i_key_b);
		o_key_b = String.fromCharCode.apply(null, o_key_b);

		sha1 = hex2string(Utils.Sha1.hash(i_key_b + domain, false));
		sha1 = hex2string(Utils.Sha1.hash(o_key_b + sha1, false));
		var base64 = Base64.base64.encode(sha1);
		return base64.substring(0, length);
	},
	HMAC_SHA1_INEXACT: function(secret, domain, length) {
		if (secret==""||domain=="") return "";

		var i_key_b = FilledArray(64,0x36);
		var o_key_b = FilledArray(64,0x5c);
		var i, j, sha1;

		secret = Utils.Utf8.encode(secret);
		domain = Utils.Utf8.encode(domain);

		if (secret.length > 64)
			secret = Utils.Sha1.hash(secret, false);

		for (i = 0, j = secret.length; i < j; i += 1) {
			i_key_b[i] ^= secret.charCodeAt(i);
			o_key_b[i] ^= secret.charCodeAt(i);
		}
		i_key_b = String.fromCharCode.apply(null, i_key_b);
		o_key_b = String.fromCharCode.apply(null, o_key_b);

		sha1 =            Utils.Sha1.hash(i_key_b + domain, false);
		sha1 = hex2string(Utils.Sha1.hash(o_key_b + sha1, false));
		var base64 = Base64.base64.encode(sha1);
		return base64.substring(0, length);
	}
};


function init(metadata) {
	let locales = metadata.path + "/locale";
	Gettext.bindtextdomain('pwCalc', locales);
	clipboard = St.Clipboard.get_default();
}

function enable() {
	pwCalc = new PasswordCalculator();
	Main.panel.addToStatusArea('pwCalc', pwCalc);
}

function disable() {
	pwCalc.destroy();
	pwCalc = null;
}
