/*
 *
 *  Password Calculator extension for GNOME Shell preferences
 *  - Creates a widget to set the preferences of the pwcalc extension
 *
 * Copyright (C) 2014-2025
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

let FooRow;

if (!GObject.type_from_name('Gjs_pwcalc_thilomaurer_de_prefs_FooRow')) {

  FooRow = GObject.registerClass({
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

} else {
  FooRow = GObject.type_from_name('Gjs_pwcalc_thilomaurer_de_prefs_FooRow');
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

    const model = new Gio.ListStore({ item_type: FooRow.$gtype });
    selection.model = model;

    //const entry = new FooRow({ alias: "0", width: "1", "creation-date": "2" });

    var updateModel = function () {
      var data = JSON.parse(settings.get_string(RECENT_URL_KEY));
      data.forEach(row => {
        if (typeof row === "string") {
          const entry = new FooRow({ alias: row, width: "default", "creation-date": "" });
          model.append(entry);
        }
        if (Array.isArray(row)) {
          const entry = new FooRow({ alias: row[0], width: row[1], "creation-date": row[2] });
          model.append(entry);
        }
      });
    }

    updateModel();

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
        data.push([item.alias, item.width, item["creation-date"]]);
      }
      settings.set_string(RECENT_URL_KEY, JSON.stringify(data));
    });


    this.Builder.get_object("tree-toolbutton-add").connect("clicked", () => {
      const dialog = new Gtk.Dialog({
        transient_for: window,
        modal: true,
        title: _("Add New Alias"),
      });

      dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
      dialog.add_button(_("Add"), Gtk.ResponseType.OK);

      const contentArea = dialog.get_content_area();

      // Create a vertical box to hold multiple inputs
      const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
        margin_top: 12,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12
      });

      // Alias input
      const aliasEntry = new Gtk.Entry({});
      box.append(new Gtk.Label({ label: _("Enter a new alias:"), halign: Gtk.Align.START }));
      box.append(aliasEntry);

      // Width input
      const widthEntry = new Gtk.Entry({ placeholder_text: _("Default width") });
      box.append(new Gtk.Label({ label: _("Enter width:"), halign: Gtk.Align.START }));
      box.append(widthEntry);

      contentArea.append(box);

      // Set default focus on the alias entry
      dialog.set_default_widget(aliasEntry);
      aliasEntry.grab_focus();

      dialog.connect("response", (dlg, response_id) => {
        if (response_id === Gtk.ResponseType.OK) {
          const aliasText = aliasEntry.get_text().trim();
          const widthText = widthEntry.get_text().trim() || "default"; // fallback if empty

          if (aliasText) {
            const now = new Date().toISOString();
            const entryObj = new FooRow({ alias: aliasText, width: widthText, "creation-date": now });
            model.append(entryObj);
          }
        }
        dlg.destroy();
      });

      dialog.show();
    });


    this.Builder.get_object("tree-toolbutton-remove").connect("clicked", () => {
      let pos = selection.get_selected();
      if (pos >= 0) {
        model.remove(pos);
      }
    });

    selection.connect('notify::selected', () => {
      let hasSelection = selection.get_selected() >= 0;
      this.Builder.get_object("tree-toolbutton-remove").sensitive = hasSelection;
    });

    this.Builder.get_object("tree-toolbutton-export").connect("clicked", () => {
      const dialog = new Gtk.FileChooserDialog({
        title: _("Export Aliases to File"),
        transient_for: window,
        action: Gtk.FileChooserAction.SAVE,
        modal: true
      });

      dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
      dialog.add_button(_("Export"), Gtk.ResponseType.ACCEPT);

      dialog.set_current_name("pwcalc-aliases.json");

      dialog.connect("response", (dlg, response_id) => {
        if (response_id === Gtk.ResponseType.ACCEPT) {
          const file = dlg.get_file();
          const path = file.get_path();
          log(path);
          if (path) {
            const data = [];

            for (let i = 0; i < model.get_n_items(); i++) {
              let item = model.get_item(i);
              data.push([item.alias, item.width, item["creation-date"]]);
            }

            try {
              const content = JSON.stringify(data, null, 2);
              const success = GLib.file_set_contents(path, content + "\n");
              if (!success)
                log("Export failed: could not write file " + path);
            } catch (e) {
              log("Export failed: " + e.message);
            }
          }
        }

        dlg.destroy();
      });

      dialog.show();
    });


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
