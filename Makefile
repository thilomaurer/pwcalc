
DEPS=schemas/gschemas.compiled

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.pwcalc.gschema.xml
	glib-compile-schemas schemas/

release: $(DEPS)
	gnome-extensions pack --podir=po --force --extra-source=convenience.js --extra-source=utils.js --extra-source=pwcalc-settings.ui

install: release
	gnome-extensions install pwcalc@thilomaurer.de.shell-extension.zip --force

