/*
 *
 *  Password Calculator extension for GNOME Shell preferences 
 *  - Creates a widget to set the preferences of the pwcalc extension
 *
 * Copyright (C) 2014
 *     Thilo Maurer <tm@thilomaurer.de>
 *
 * This file is part of gnome-shell-extension-pwcalc.
 *
 * gnome-shell-extension-pwcalc is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell-extension-pwcalc is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell-extension-pwcalc.  If not, see
 * <http://www.gnu.org/licenses/>.
 *
 */

const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('pwCalc');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const EXTENSIONDIR = Me.dir.get_path();

const RECENT_URL_KEY = 'recenturls';
const SHOW_COPY_NOTIFICATION_KEY = 'show-copy-notification';
const COPY_TO_CLIPBOARD_KEY = 'copy-to-clipboard';
const COPY_TO_PRIMARY_KEY = 'copy-to-primary-selection';

let settings;
let boolSettings;

function _createBoolSetting(setting) {
  let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});

  let settingLabel = new Gtk.Label({label: boolSettings[setting].label,
                                    xalign: 0});

  let settingSwitch = new Gtk.Switch({active: settings.get_boolean(setting)});
  settingSwitch.connect('notify::active', function(button) {
    settings.set_boolean(setting, button.active);
  });

  if (boolSettings[setting].help) {
    settingLabel.set_tooltip_text(boolSettings[setting].help);
    settingSwitch.set_tooltip_text(boolSettings[setting].help);
  }

  hbox.pack_start(settingLabel, true, true, 0);
  hbox.add(settingSwitch);

  return hbox;
}

/*
   Shell-extensions handlers
*/

function init() {
  let schema = 'org.gnome.shell.extensions.pwcalc';
  settings = Convenience.getSettings(schema);
  boolSettings = {};
}

function buildPrefsWidget() {
    var self=this;

	this.Window = new Gtk.Builder();
	this.Window.add_from_file(EXTENSIONDIR+"/pwcalc-settings.ui");
    this.MainWidget = Window.get_object("main-widget");
    this.treeview = this.Window.get_object("tree-treeview");
    this.liststore = this.Window.get_object("liststore");
    this.Iter = this.liststore.get_iter_first();
    this.selectedItem = null;

    var updateListStore = function(aliases) {
    	if(typeof self.liststore != "undefined") self.liststore.clear();
    	let current = self.liststore.get_iter_first();
	    for(let i in aliases)
	    {
        	current = self.liststore.append();
        	self.liststore.set_value(current, 0, aliases[i]);
	    }
    }
    
	var removeSelectedItem = function() {
		var ac = self.selectedItem;
		if (ac==null) return;
		var l=getrecentURL();
		let textDialog = _("Remove Alias '%s' ?").replace("%s",l[ac]);
		let dialog = new Gtk.Dialog({title : ""});
		let label = new Gtk.Label({label : textDialog});
		label.margin_bottom = 12;

		dialog.set_border_width(12);
		dialog.set_modal(1);
		dialog.set_resizable(0);
		//dialog.set_transient_for(***** Need parent Window *****);

		dialog.add_button(Gtk.STOCK_CANCEL, 0);
		let d = dialog.add_button(Gtk.STOCK_REMOVE, 1);

		d.set_can_default(true);
		dialog.set_default(d);

		let dialog_area = dialog.get_content_area();
		dialog_area.pack_start(label,0,0,0);
		dialog.connect("response",function(w, response_id)
		{
			if(response_id) {
				l.splice(ac,1);
				setrecentURL(l);
				updateListStore(l);
			}
			dialog.hide();
		});

		dialog.show_all();
	}

    var addItemUsingInputBox = function() {
        let textDialog = _("New alias");
        let dialog = new Gtk.Dialog({title : ""});
        let entry = new Gtk.Entry();
        entry.margin_top = 12;
        entry.margin_bottom = 12;
        let label = new Gtk.Label({label : textDialog});

        dialog.set_border_width(12);
        dialog.set_modal(1);
        dialog.set_resizable(0);
        //dialog.set_transient_for(***** Need parent Window *****);

        dialog.add_button(Gtk.STOCK_CANCEL, 0);
        let d = dialog.add_button(Gtk.STOCK_OK, 1);

        d.set_can_default(true);
        d.sensitive = 0;
        let testAlias = function(location) {
	        d.sensitive = 0;
                if (entry.get_text()) d.sensitive = 1;
        	return 0;
        };

        entry.connect("changed",testAlias);

        dialog.set_default(d);
        entry.activates_default = true;

        let dialog_area = dialog.get_content_area();
        dialog_area.pack_start(label,0,0,0);
        dialog_area.pack_start(entry,0,0,0);
        dialog.connect("response",function(w, response_id)
        {
		let alias = entry.get_text();
		        if(response_id && alias)
		        {
				var l=getrecentURL();
				l.push(alias);
				l.sort();
				setrecentURL(l);
				updateListStore(l);
			}
		dialog.destroy();
		return 0;
        });

        dialog.show_all();
    };

    this.Window.get_object("tree-toolbutton-add").connect("clicked",function()
    {
	    addItemUsingInputBox();
    });

    this.Window.get_object("tree-toolbutton-remove").connect("clicked",function()
    {
	    removeSelectedItem();
    });

    var exportimport=function() {

	let bld = new Gtk.Builder();
	bld.add_from_file(EXTENSIONDIR+"/settings-importexport.ui");
	let dialog = bld.get_object("dialog");
	let tb = bld.get_object("textbuffer");
	let d = bld.get_object("import");
	let cancel = bld.get_object("cancel");
	d.sensitive = 0;
	let newRecentURL;
	let testAlias = function() {
		try
		{
			newRecentURL=JSON.parse(tb.text);
			d.sensitive = 1;
		}
		catch(e)
		{
			d.sensitive = 0;
		}
        	return 0;
        };

        tb.connect("changed",testAlias);
	tb.text=JSON.stringify(getrecentURL());

        dialog.set_default(cancel);

        dialog.connect("response",function(w, response_id)
        {
	        if (response_id==1)
	        {		
			setrecentURL(newRecentURL);
			updateListStore(newRecentURL);
		}
		dialog.destroy();
		return 0;
        });
        dialog.run();
    }

    this.Window.get_object("tree-toolbutton-export").connect("clicked",function()
    {
	exportimport();
    });

    this.treeview.connect("key-press-event",function(sender,event)
    {
		if (event.keyval==Gdk.KEY_Delete) removeSelectedItem();
    });

    this.Window.get_object("treeview-selection").connect("changed",function(select)
    {
    	let a = select.get_selected_rows(this.liststore)[0][0];
	let sens=(a!=null);

	if (sens) self.selectedItem = parseInt(a.to_string());
	self.Window.get_object("tree-toolbutton-remove").sensitive = sens
    });

    this.treeview.set_model(this.liststore);

    let column = new Gtk.TreeViewColumn()
    this.treeview.append_column(column);    
    
    let renderer = new Gtk.CellRendererText();
    column.pack_start(renderer,null);
    column.set_cell_data_func(renderer,function()
    {
	    arguments[1].markup = arguments[2].get_value(arguments[3],0);
    }); 
    
	if(typeof this.liststore != "undefined") this.liststore.clear();
	
	var getrecentURL=function()
	{
		var settings = Convenience.getSettings();
		var js=settings.get_string(RECENT_URL_KEY);
		var obj;
		try
		{
			obj=JSON.parse(js);
		}
		catch(e)
		{
			obj=[];
		}
	    return obj;
	};

	var setrecentURL=function(v)
	{
		var js=JSON.stringify(v);
		var settings = Convenience.getSettings();
		settings.set_string(RECENT_URL_KEY,js);
	};

        var getBool=function(key) 
        { 
		var settings = Convenience.getSettings();
	        return settings.get_boolean(key); 
        };
 
        var setBool=function(key,v) 
        { 
		var settings = Convenience.getSettings();
	        settings.set_boolean(key,v); 
        };

   	this.Window.get_object("tree-toolbutton-remove").sensitive = false;

	var bool2switch=function(objectkey,settingskey) {
		var s=self.Window.get_object(objectkey);
		s.active=getBool(settingskey);
		s.connect("notify::active",function(){ setBool(settingskey,arguments[0].active);});
	};
	bool2switch("show-notification-switch",SHOW_COPY_NOTIFICATION_KEY);
	bool2switch("copy-to-clipboard-switch",COPY_TO_CLIPBOARD_KEY);
	bool2switch("copy-to-primary-switch",COPY_TO_PRIMARY_KEY);


	var settings = Convenience.getSettings();
	settings.connect("changed", function(sender, key) {
		updateListStore(getrecentURL());	
	});

	updateListStore(getrecentURL());

	this.MainWidget.show_all();
	return MainWidget;
}
