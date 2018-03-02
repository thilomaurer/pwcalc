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
const Clutter = imports.gi.Clutter;
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
const KEEP_COPY_OF_ALIASES_IN_FILE_KEY = 'keep-copy-of-aliases-in-file';
const KEEP_COPY_OF_ALIASES_FILENAME_KEY = 'keep-copy-of-aliases-filename';
const DEFAULT_PASSWORD_LENGTH_KEY = 'default-password-length';
const PASSWORD_METHOD_KEY = 'password-method';

/*
   Shell-extensions handlers
*/

function init() {
}

function buildPrefsWidget() {
	var self=this;
	
	var settings = Convenience.getSettings();
	
	this.Builder = new Gtk.Builder();
	this.Builder.add_from_file(EXTENSIONDIR+"/pwcalc-settings.ui");
	this.MainWidget = Builder.get_object("main-widget");
	this.treeview = this.Builder.get_object("tree-treeview");
	this.liststore = this.Builder.get_object("liststore");
	this.Iter = this.liststore.get_iter_first();
	this.selectedItem = null;

	var updateListStore = function(aliases) {
	if(typeof self.liststore != "undefined") self.liststore.clear();
		let current = self.liststore.get_iter_first();
		for(let i in aliases) {
			current = self.liststore.append();
			self.liststore.set_value(current, 0, aliases[i]);
		}
	}
    
	var removeSelectedItem = function() {
		var ac = self.selectedItem;
		if (ac==null) return;
		var l=getrecentURL();
		let textDialog = _("Remove Alias '%s' ?").replace("%s",l[ac]);
		let dialog = new Gtk.Dialog({title : "Alias Removal"});
		let label = new Gtk.Label({label : textDialog});
		label.margin_bottom = 12;

		dialog.set_border_width(12);
		dialog.set_modal(1);
		dialog.set_resizable(0);
        	dialog.set_transient_for(self.MainWidget.get_toplevel());

		let cancelbutton = dialog.add_button(Gtk.STOCK_CANCEL, 0);
		let removebuton = dialog.add_button(Gtk.STOCK_REMOVE, 1);

		cancelbutton.set_can_default(true);
		dialog.set_default(cancelbutton);

		let dialog_area = dialog.get_content_area();
		dialog_area.pack_start(label,0,0,0);
		dialog.connect("response",function(w, response_id)
		{
			if(response_id==1) {
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
        dialog.set_transient_for(self.MainWidget.get_toplevel());

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
		        if(response_id == 1 && alias)
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

    this.Builder.get_object("tree-toolbutton-add").connect("clicked",function()
    {
	    addItemUsingInputBox();
    });

    this.Builder.get_object("tree-toolbutton-remove").connect("clicked",function()
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
        dialog.set_transient_for(self.MainWidget.get_toplevel());

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

    this.Builder.get_object("tree-toolbutton-export").connect("clicked",function()
    {
	exportimport();
    });

    this.treeview.connect("key-press-event",function(sender,event)
    {
	var kv=event.get_keyval()[1];
	if (kv==Clutter.Delete||kv==Clutter.BackSpace) removeSelectedItem();
    });

    this.Builder.get_object("treeview-selection").connect("changed",function(select)
    {
    	let a = select.get_selected_rows()[0][0];
	let sens=(a!=null);

	if (sens) self.selectedItem = parseInt(a.to_string());
	self.Builder.get_object("tree-toolbutton-remove").sensitive = sens
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
	
	var getrecentURL=function() {
		var js=getString(RECENT_URL_KEY);
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

	var setrecentURL=function(v) {
		var js=JSON.stringify(v);
		setString(RECENT_URL_KEY,js);
	};

        var getBool=function(key) { 
	        return settings.get_boolean(key); 
        };
        
        var setBool=function(key,v) { 
	        settings.set_boolean(key,v); 
        };
        
	var getInteger=function(key) { 
	        return settings.get_int(key); 
        };
        
        var setInteger=function(key,v) { 
	        settings.set_int(key,v); 
        };
	
	var getString=function(key) { 
	        return settings.get_string(key); 
        };
        
	var setString=function(key,v) {
		settings.set_string(key,v); 
        };
 

   	this.Builder.get_object("tree-toolbutton-remove").sensitive = false;

	var bool2switch=function(objectkey,settingskey) {
		var s=self.Builder.get_object(objectkey);
		s.active=getBool(settingskey);
		s.connect("notify::active",function() { setBool(settingskey,arguments[0].active); });
	};
	bool2switch("show-notification-switch",SHOW_COPY_NOTIFICATION_KEY);
	bool2switch("copy-to-clipboard-switch",COPY_TO_CLIPBOARD_KEY);
	bool2switch("copy-to-primary-switch",COPY_TO_PRIMARY_KEY);
	bool2switch("keep-copy-of-aliases-in-file-switch",KEEP_COPY_OF_ALIASES_IN_FILE_KEY);

	var string2label=function(objectkey,settingskey) {
		var s=self.Builder.get_object(objectkey);
		var update = function() {
			var label=getString(settingskey);
			if (label=="") label="(none)";
			s.label=label;
			s.tooltip_text=label;
		}
		settings.connect("changed::"+settingskey, function(sender, key) {
			update();
		});
		update();
	};
	string2label("keep-copy-of-aliases-filename-label",KEEP_COPY_OF_ALIASES_FILENAME_KEY);

	var float2spin=function(objectkey,settingskey) {
		var s=self.Builder.get_object(objectkey);
		s.value=getInteger(settingskey);
		s.connect("notify::value",function() { setInteger(settingskey,arguments[0].value); });
	};
	float2spin("default-password-length-adjustment",DEFAULT_PASSWORD_LENGTH_KEY);

	var string2combo=function(objectkey,settingskey) {
		var s=self.Builder.get_object(objectkey);
		s.active_id=getString(settingskey);
/*
		s.connect("notify::active_id",function() { 
			setString(settingskey,arguments[0].active_id);
		});
*/
		s.connect("notify::active",function() { 
			global.log("active",JSON.stringify(arguments));
			setString(settingskey,arguments[0].active_id);
		});
	};
	string2combo("password-method-combobox",PASSWORD_METHOD_KEY);

	self.Builder.get_object("keep-copy-of-aliases-filename-button").connect("clicked",function() {
		let dialog = new Gtk.FileChooserDialog({
			title:_("Select Filename to Keep Aliases"),
			transient_for: self.MainWidget.get_toplevel(),
			action: Gtk.FileChooserAction.SAVE,
			do_overwrite_confirmation: true,
			modal: true
		});
		dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
		dialog.add_button(Gtk.STOCK_SAVE, Gtk.ResponseType.ACCEPT);
		var res=dialog.run();
		if (res == Gtk.ResponseType.ACCEPT) {
			var filename = dialog.get_filename();
			setString("keep-copy-of-aliases-filename",filename);
		}
		dialog.destroy();
	});


	settings.connect("changed", function(sender, key) {
		if (key==RECENT_URL_KEY)
			updateListStore(getrecentURL());	
	});

	updateListStore(getrecentURL());

	this.MainWidget.show_all();
	return MainWidget;
}
