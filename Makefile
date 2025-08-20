
DEPS=schemas/gschemas.compiled

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.pwcalc.gschema.xml
	glib-compile-schemas schemas/

release: $(DEPS)
	gnome-extensions pack --podir=po --force --extra-source=utils.js --extra-source=pwcalc-settings.ui --extra-source=prefs.css --extra-source=settings-importexport.ui --extra-source=settings-importexport.cmb.ui

install: release
	gnome-extensions install pwcalc@thilomaurer.de.shell-extension.zip --force

