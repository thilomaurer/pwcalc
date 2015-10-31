const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Shell = imports.gi.Shell;
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


function PasswordCalculator() { 
  this._init();
}

const MyPopupMenuItem = new Lang.Class({
    Name: 'MyPopupMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (text, params) {
        this.parent(params);

        this.label = new St.Label({ text: text });
        this.actor.add_child(this.label);
        this.actor.label_actor = this.label;
    },
    activate: function(event) {
        //this.emit('activate', event);
	this._parent.close(true);
	this.emit('selected');
//	global.log(JSON.stringify(this._parent));
    }
});



PasswordCalculator.prototype = {
  __proto__: PanelMenu.Button.prototype,
  
  _init: function() {     
    let self=this;
    this.loadConfig();
    PanelMenu.Button.prototype._init.call(this, St.Align.START);

    this.iconActor = new St.Icon({ icon_name: 'dialog-password-symbolic',
                                    style_class: 'system-status-icon' });
    this.actor.add_actor(this.iconActor);

    // Bottom section
    let bottomSection = new PopupMenu.PopupMenuSection();
    this.headingLabel = new St.Label({ text:_("Password Calculator"), style_class: "heading", can_focus:false });
   
    let secretChanged = function(o,e) {
	let st = self.secretText;
        let sec = st.get_text();
	let pwc='';
	if (sec!="") pwc='\u25cf'; // ● U+25CF BLACK CIRCLE
	st.clutter_text.set_password_char(pwc);
    };
    
    let gen = function(o,e) {
        let url = self.urlText.get_text();
        let sec = self.secretText.get_text();
	if ((url!="")&&(sec!="")) {
		let pwd = calculatePassword(sec, url);
		let len=16;
		self.pwdText.set_text(pwd[0]+pwd[1]+pwd[2]+Array(len+1-6).join("\u00B7")+pwd[len-3]+pwd[len-2]+pwd[len-1]);
		let symbol = e.get_key_symbol();
		if (symbol == Clutter.Return) {
		    if (self.ShowCopyNotification) showMessage("Password Calculator: Password copied to clipboard.");
		    if (self.CopyToClipboard) clipboard.set_text(CLIPBOARD_TYPE,pwd);
		    if (self.CopyToPrimarySelection) clipboard.set_text(PRIMARY_TYPE,pwd);
		    var a=self.recentURL;
		    if (a.indexOf(url)<0) a[a.length]=url;
		    a.sort();
		    self.recentURL=a;
		    self.menu.actor.hide();
		}
	} else {
        	self.pwdText.set_text(_("your password"));
	}
    };
    
    var removeDuplicates = function(a) {
        var b = {};
        for (var i = 0; i < a.length; i++) {
            b[a[i]] = a[i];
        }
        var c = [];
        for (var key in b) {
            c.push(key);
        }
        return c;
    }
    
    this.urlCombo = new PopupMenu.PopupSubMenuMenuItem("");

    let updateRecentURL = function() {
        var a=removeDuplicates(self.recentURL);
        self.recentURL=a;
        self.urlCombo.menu.removeAll();
        for (let i=0;i<a.length;i++) {
//            let item = new PopupMenu.PopupMenuItem(a[i], { activate: false });
            let item = new MyPopupMenuItem(a[i]);
            self.urlCombo.menu.addMenuItem(item, i);
	    item.connect('selected', Lang.bind(self, self.urlSelected, a[i]));
        }
	let labeltext;
        if (a.length==0) labeltext=_("No Recent Aliases");
		else labeltext=_("Recent Aliases");
        self.urlCombo.label.set_text(labeltext);
    };

    let clear = function(o,e) {
        self.urlText.set_text("");
        self.secretText.set_text("");
        self.pwdText.set_text(_("your password"));
        updateRecentURL();
    };
    
    this.urlText = new St.Entry({
      name: "searchEntry",
      hint_text: _("alias"),
      track_hover: true,
      can_focus: true,
      style_class: "search-entry first"
    });

    this.urlText.clutter_text.connect('key-release-event', gen);
    
    this.secretText = new St.Entry({
      name: "searchEntry",
      hint_text: _("secret"),
      track_hover: true,
      can_focus: true,
      style_class: "search-entry last"
    }); 
    this.secretText.clutter_text.connect('text-changed', secretChanged);
    this.secretText.clutter_text.connect('key-release-event', gen);
    this.pwdText = new St.Label({style_class: "pwd", can_focus:false});
    bottomSection.actor.add_actor(this.headingLabel);
    bottomSection.actor.add_actor(this.urlText);
    bottomSection.actor.add_actor(this.secretText);
    bottomSection.actor.add_actor(this.pwdText);
    bottomSection.actor.add_style_class_name("pwCalc");
    this.menu.addMenuItem(bottomSection);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());    
    this.menu.addMenuItem(this.urlCombo);

    
	let item = new PopupMenu.PopupMenuItem(_("Settings"));
	item.connect('activate', Lang.bind(this, this._onPreferencesActivate));
	this.menu.addMenuItem(item);
   
    this.menu.connect('open-state-changed', function(sender,open) {
        clear();
	if (!open) self.urlText.clutter_text.grab_key_focus();
    });

    updateRecentURL();    
  },
  
  _onPreferencesActivate : function() {
    Util.spawn(["gnome-shell-extension-prefs","pwcalc@thilomaurer.de"]);
    return 0;
  },
  
  urlSelected: function(sender,URL) {
    this.urlText.set_text(URL);
    this.secretText.clutter_text.grab_key_focus();
  },

  loadConfig : function() {
	let that = this;
  	this._settings = Convenience.getSettings();
	//this._settingsC = this._settings.connect("changed",function(){that.refreshWeather(false);});
  },
  
  _enable: function() {
  },

  _disable: function() {
  },
  	get recentURL()
	{
    	if(!this._settings)	this.loadConfig();
    	var js=this._settings.get_string(RECENT_URL_KEY);
    	var obj;
		try
		{
        	obj=JSON.parse(js);
		}
		catch(e)
		{
	    	obj=[];
		}
    	//global.log("get:" +JSON.stringify(obj));
	    return obj;
	},

	set recentURL(v)
	{
	    var js=JSON.stringify(v);
    	//global.log("set:" +js);
		if(!this._settings) this.loadConfig();
    	this._settings.set_string(RECENT_URL_KEY,js);
	},
        getBool: function(key) 
        { 
		var settings = Convenience.getSettings();
	        return settings.get_boolean(key); 
        },
	get ShowCopyNotification() {
		return this.getBool(SHOW_COPY_NOTIFICATION_KEY);
	},
	get CopyToClipboard() {
		return this.getBool(COPY_TO_CLIPBOARD_KEY);
	},
	get CopyToPrimarySelection() {
		return this.getBool(COPY_TO_PRIMARY_KEY);
	}
}

function showMessage(text) { 
    let source = new MessageTray.SystemNotificationSource();
    Main.messageTray.add(source);
    let notification = new MessageTray.Notification(source, text, null);
    notification.setTransient(true);
    source.notify(notification);
}

   
function calculatePassword(secret, domain) {
        if (secret==""||domain=="") return "";
        var sha1 = Utils.Sha1.hash(secret + domain);
        var array = sha1.match(/.{1,2}/g);
        var bytes = new Uint8Array(20);
        for (var i = 0, j = array.length; i < j; i += 1)
            bytes[i] = parseInt(array[i], 16);
        var base64 = Base64.base64.encode(String.fromCharCode.apply(null, bytes));
        return base64.substring(0, 16);
}

// Init function
function init(metadata){ 
  let locales = metadata.path + "/locale";
  Gettext.bindtextdomain('pwCalc', locales);
  clipboard = St.Clipboard.get_default();
}

function enable(){
  pwCalc = new PasswordCalculator();
  pwCalc._enable();
  Main.panel.addToStatusArea('pwCalc', pwCalc);
}

function disable(){
  pwCalc._disable();
  pwCalc.destroy();
  pwCalc = null;
}

