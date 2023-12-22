/*
 *
 *  Password Calculator extension for GNOME Shell preferences
 *  - Creates a widget to set the preferences of the pwcalc extension
 *
 * Copyright (C) 2014-2023
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

import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

const RECENT_URL_KEY = 'recenturls';
const SHOW_COPY_NOTIFICATION_KEY = 'show-copy-notification';
const COPY_TO_CLIPBOARD_KEY = 'copy-to-clipboard';
const COPY_TO_PRIMARY_KEY = 'copy-to-primary-selection';
const KEEP_COPY_OF_ALIASES_IN_FILE_KEY = 'keep-copy-of-aliases-in-file';
const KEEP_COPY_OF_ALIASES_FILENAME_KEY = 'keep-copy-of-aliases-filename';
const DEFAULT_PASSWORD_LENGTH_KEY = 'default-password-length';
const PASSWORD_METHOD_KEY = 'password-method';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function bind_AdwComboRow(settings, key, comboRow) {

  var stringList = comboRow.get_model();

  // Function to update the comboRow selection based on the GSettings value
  function updateComboRowFromSettings() {
    const value = settings.get_string(key);
    let index = -1;
    for (let i = 0; i < stringList.get_n_items(); i++) {
      if (stringList.get_string(i) === value) {
        index = i;
        break;
      }
    }
    if (index !== -1) {
      comboRow.set_selected(index);
    }
  }

  // Function to update the GSettings value based on the comboRow selection
  function updateSettingsFromComboRow() {
    const position = comboRow.get_selected();
    if (position !== -1) {
      const value = stringList.get_string(position);
      settings.set_string(key, value);
    }
  }

  // Connect the change signal of GSettings
  settings.connect(`changed::${key}`, updateComboRowFromSettings);

  // Connect the change signal of the comboRow
  comboRow.connect('notify::selected', updateSettingsFromComboRow);

  // Initial synchronization
  updateComboRowFromSettings();
}

export default class pwcalcExtensionPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {

    var self = this;

    window._settings = this.getSettings();
    var settings = window._settings;
    var path = this.metadata.path;

    //load CSS from preferences GTK Window
    let provider = new Gtk.CssProvider();
    provider.load_from_path(path + '/prefs.css');
    Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

    this.Builder = new Gtk.Builder();
    this.Builder.set_scope(new pwcalcBuilderScope());
    this.Builder.add_from_file(path + "/pwcalc-settings.ui");

    var spage = this.Builder.get_object("settings-page");
    var apage = this.Builder.get_object("aliases-page");

    window.add(spage);
    window.add(apage);

    settings.bind(SHOW_COPY_NOTIFICATION_KEY, this.Builder.get_object("show-notification-switch"), 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind(COPY_TO_CLIPBOARD_KEY, this.Builder.get_object("copy-to-clipboard-switch"), 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind(COPY_TO_PRIMARY_KEY, this.Builder.get_object("copy-to-primary-switch"), 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind(KEEP_COPY_OF_ALIASES_IN_FILE_KEY, this.Builder.get_object("keep-copy-of-aliases-in-file-switch"), 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind(DEFAULT_PASSWORD_LENGTH_KEY, this.Builder.get_object("default-password-length-adjustment"), 'value', Gio.SettingsBindFlags.DEFAULT);
    settings.bind(KEEP_COPY_OF_ALIASES_FILENAME_KEY, this.Builder.get_object("keep-copy-of-aliases-filename-label"), 'label', Gio.SettingsBindFlags.DEFAULT);
    //settings.bind(PASSWORD_METHOD_KEY, this.Builder.get_object("password-method-combobox"), 'selected-item', Gio.SettingsBindFlags.DEFAULT);
    bind_AdwComboRow(settings, PASSWORD_METHOD_KEY, this.Builder.get_object("password-method-combobox"));

    // Filename for keeping aliases (in addition to gsettings)
    self.Builder.get_object("keep-copy-of-aliases-filename-button").connect("clicked", function () {
      let dialog = new Gtk.FileChooserDialog({
        title: _("Select Filename to Keep Aliases"),
        transient_for: window,
        action: Gtk.FileChooserAction.SAVE,
        modal: true
      });
      dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
      dialog.add_button("Save", Gtk.ResponseType.ACCEPT);

      dialog.connect("response", (dlg, response) => {
        if (response === Gtk.ResponseType.ACCEPT) {
          const file = dlg.get_file();
          if (file) {
            const filename = file.get_path(); // This gets the file path as a string
            settings.set_string(KEEP_COPY_OF_ALIASES_FILENAME_KEY, filename);
          }
        }
        dialog.destroy();
      });

      dialog.show();
    });

    // Aliases Column View
    //const model = this.Builder.get_object("aliases-model"); //GListStore
    const selection = this.Builder.get_object("aliases-table-selection");
    const columnView = this.Builder.get_object("aliases-table");

    const FooRow = GObject.registerClass({
      Properties: {
        'alias': GObject.ParamSpec.string(
          'alias',
          'Alias',
          'Alias of the entry',
          GObject.ParamFlags.READWRITE,
          ''
        ),
        'width': GObject.ParamSpec.string(
          'width',
          'Width',
          'Width of the entry',
          GObject.ParamFlags.READWRITE,
          ''
        ),
        'creation-date': GObject.ParamSpec.string(
          'creation-date',
          'CreationDate',
          'Creation Date of the entry',
          GObject.ParamFlags.READWRITE,
          ''
        )
      }
    }, class FooRow extends GObject.Object {
      _init(props = {}) {
        super._init(props);
      }
    });

    const model = new Gio.ListStore({ item_type: FooRow.$gtype });
    selection.model = model;

    console.log(model);
    console.log(model.item_type);

    const entry = new FooRow({ alias: "0", width: "1", "creation-date": "2" });
    console.log(entry);

    var updateModel = function () {
      var data = JSON.parse(settings.get_string(RECENT_URL_KEY));
      data.forEach(row => {
        console.log(row);
        console.log(typeof row);
        if (typeof row === "string") {
          const entry = new FooRow({ alias: row, width: "default", "creation-date": "" });
          model.append(entry);
        }
        if (typeof row === "array") {
          const entry = new FooRow({ alias: row[0], width: row[1], "creation-date": row[2] });
          model.append(entry);
        }
      });
    }

    updateModel();
    //console.log(model);
    //console.log(JSON.stringify(model));

    // Alias Column
    const aliasFactory = new Gtk.SignalListItemFactory();
    aliasFactory.connect("setup", (factory, listItem) => {
      listItem.set_child(new Gtk.Label({ xalign: 0 }));
    });
    aliasFactory.connect("bind", (factory, listItem) => {
      const item = model.get_item(listItem.get_position());
      listItem.get_child().set_label(item.alias);
    });
    const aliasColumn = new Gtk.ColumnViewColumn({
      title: "Alias",
      factory: aliasFactory,
      expand: true
    });
    columnView.append_column(aliasColumn);

    // Width Column
    const widthFactory = new Gtk.SignalListItemFactory();
    widthFactory.connect("setup", (factory, listItem) => {
      listItem.set_child(new Gtk.Label({ xalign: 0 }));
    });
    widthFactory.connect("bind", (factory, listItem) => {
      const item = model.get_item(listItem.get_position());
      listItem.get_child().set_label(item.width);
    });
    const widthColumn = new Gtk.ColumnViewColumn({
      title: "Width",
      factory: widthFactory
    });
    columnView.append_column(widthColumn);

    // CreationDate Column
    const creationdateFactory = new Gtk.SignalListItemFactory();
    creationdateFactory.connect("setup", (factory, listItem) => {
      listItem.set_child(new Gtk.Label({ xalign: 0 }));
    });
    creationdateFactory.connect("bind", (factory, listItem) => {
      const item = model.get_item(listItem.get_position());
      listItem.get_child().set_label(item["creation-date"]);
    });
    const creationdateColumn = new Gtk.ColumnViewColumn({
      title: "CreationDate",
      factory: creationdateFactory
    });
    columnView.append_column(creationdateColumn);

    model.connect('items-changed', () => {
      const data = [];
      for (let i = 0; i < model.get_n_items(); i++) {
        let item = model.get_item(i);
        data.push({
          alias: item.alias,
          width: item.width,
          creationDate: item["creation-date"]
        });
      }
      settings.set_string(MODEL_KEY, JSON.stringify(data));
    });


    return;

    this.treeview = this.Builder.get_object("tree-treeview");
    this.liststore = this.Builder.get_object("liststore");
    this.Iter = this.liststore.get_iter_first();
    this.selectedItem = null;



    var updateListStore = function (aliases) {
      if (typeof model != "undefined") model.clear();
      let current = model.get_iter_first();
      for (let i in aliases) {
        current = model.append();
        model.set_value(current, 0, aliases[i]);
      }
    }

    var removeSelectedItem = function () {
      var ac = self.selectedItem;
      if (ac == null) return;
      var l = getrecentURL();
      let textDialog = _("Remove Alias '%s' ?").replace("%s", l[ac]);
      let dialog = new Gtk.Dialog({
        title: _("Alias Removal")
      });

      let label = new Gtk.Label({
        label: textDialog,
        css_classes: ["mylabel"]
      });

      dialog.set_modal(1);
      dialog.set_resizable(0);
      dialog.set_transient_for(self.MainWidget.get_root());

      let cancelbutton = dialog.add_button("Cancel", 0);
      let removebuton = dialog.add_button("Remove", 1);

      let dialog_area = dialog.get_content_area();
      dialog_area.prepend(label);
      dialog.connect("response", function (w, response_id) {
        if (response_id == 1) {
          l.splice(ac, 1);
          setrecentURL(l);
          updateListStore(l);
        }
        dialog.hide();
      });
      dialog.show();
    }

    var addItemUsingInputBox = function () {
      let textDialog = _("Enter new alias");
      let dialog = new Gtk.Dialog({
        title: _("Add new alias")
      });
      let entry = new Gtk.Entry({
        css_classes: ["mylabel"]
      });
      let label = new Gtk.Label({
        label: textDialog,
        css_classes: ["mylabel"]
      });

      dialog.set_modal(1);
      dialog.set_resizable(0);
      dialog.set_transient_for(self.MainWidget.get_root());

      dialog.add_button("Cancel", 0);
      let d = dialog.add_button("OK", 1);

      d.sensitive = 0;
      let testAlias = function (location) {
        d.sensitive = 0;
        if (entry.get_text()) d.sensitive = 1;
        return 0;
      };

      entry.connect("changed", testAlias);

      entry.activates_default = true;

      let dialog_area = dialog.get_content_area();
      dialog_area.append(label);
      dialog_area.append(entry);
      dialog.connect("response", function (w, response_id) {
        let alias = entry.get_text();
        if (response_id == 1 && alias) {
          var l = getrecentURL();
          l.push(alias);
          l.sort();
          setrecentURL(l);
          updateListStore(l);
        }
        dialog.destroy();
        return 0;
      });

      dialog.show();
    };

    this.Builder.get_object("tree-toolbutton-add").connect("clicked", function () {
      addItemUsingInputBox();
    });

    this.Builder.get_object("tree-toolbutton-remove").connect("clicked", function () {
      removeSelectedItem();
    });

    var exportimport = function () {

      let bld = new Gtk.Builder();
      bld.add_from_file(path + "/settings-importexport.ui");
      let dialog = bld.get_object("dialog");
      let tb = bld.get_object("textbuffer");
      let d = bld.get_object("import");
      let cancel = bld.get_object("cancel");
      d.sensitive = 0;
      let newRecentURL;
      let testAlias = function () {
        try {
          newRecentURL = JSON.parse(tb.text);
          d.sensitive = 1;
        } catch (e) {
          d.sensitive = 0;
        }
        return 0;
      };

      tb.connect("changed", testAlias);
      tb.text = JSON.stringify(getrecentURL());

      dialog.set_default_widget(cancel);
      dialog.set_transient_for(self.MainWidget.get_root());

      dialog.connect("response", function (w, response_id) {
        if (response_id == 1) {
          setrecentURL(newRecentURL);
          updateListStore(newRecentURL);
        }
        dialog.destroy();
        return 0;
      });
      dialog.show_all();
    }

    this.Builder.get_object("tree-toolbutton-export").connect("clicked", function () {
      exportimport();
    });

    // this.treeview.connect("key-press-event", function(sender, event) {
    //   var kv = event.get_keyval()[1];
    //   if (kv == Gdk.KEY_Delete || kv == Gdk.KEY_BackSpace) removeSelectedItem();
    // });

    this.Builder.get_object("treeview-selection").connect("changed", function (select) {
      let a = select.get_selected_rows()[0][0];
      let sens = (a != null);

      if (sens) self.selectedItem = parseInt(a.to_string());
      self.Builder.get_object("tree-toolbutton-remove").sensitive = sens
    });

    /*
    this.treeview.set_model(this.liststore);
     
    let column = new Gtk.TreeViewColumn()
    this.treeview.append_column(column);
     
    let renderer = new Gtk.CellRendererText();
    column.pack_start(renderer, null);
    column.set_cell_data_func(renderer, function () {
      arguments[1].markup = arguments[2].get_value(arguments[3], 0);
    });
     
    if (typeof this.liststore != "undefined") this.liststore.clear();
    */

    var getrecentURL = function () {
      var js = getString(RECENT_URL_KEY);
      var obj;
      try {
        obj = JSON.parse(js);
      } catch (e) {
        obj = [];
      }
      return obj;
    };

    var setrecentURL = function (v) {
      var js = JSON.stringify(v);
      setString(RECENT_URL_KEY, js);
    };

    var getBool = function (key) {
      return settings.get_boolean(key);
    };

    var setBool = function (key, v) {
      settings.set_boolean(key, v);
    };

    var getInteger = function (key) {
      return settings.get_int(key);
    };

    var setInteger = function (key, v) {
      settings.set_int(key, v);
    };

    var getString = function (key) {
      return settings.get_string(key);
    };

    var setString = function (key, v) {
      settings.set_string(key, v);
    };


    this.Builder.get_object("tree-toolbutton-remove").sensitive = false;

    self.Builder.get_object("keep-copy-of-aliases-filename-button").connect("clicked", function () {
      let dialog = new Gtk.dialog({
        title: _("Select Filename to Keep Aliases"),
        transient_for: self.MainWidget.get_root(),
        action: Gtk.FileChooserAction.SAVE,
        modal: true
      });
      dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
      dialog.add_button("Save", Gtk.ResponseType.ACCEPT);
      dialog.connect('response', function (res) {
        if (res == Gtk.ResponseType.ACCEPT) {
          var filename = dialog.get_filename();
          setString("keep-copy-of-aliases-filename", filename);
        }
      });
      dialog.show
    });
    /*
        settings.connect("changed", function (sender, key) {
          if (key == RECENT_URL_KEY)
            updateListStore(getrecentURL());
        });
        updateListStore(getrecentURL());
    
    */
  }
}

const pwcalcBuilderScope = GObject.registerClass({
  Implements: [Gtk.BuilderScope],
}, class pwcalcBuilderScope extends GObject.Object {

  vfunc_create_closure(builder, handlerName, flags, connectObject) {
    if (flags & Gtk.BuilderClosureFlags.SWAPPED)
      throw new Error('Unsupported template signal flag "swapped"');

    if (typeof this[handlerName] === 'undefined')
      throw new Error(`${handlerName} is undefined`);

    return this[handlerName].bind(connectObject || this);
  }
});
