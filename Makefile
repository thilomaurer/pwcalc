INSTALLPATH=~/.local/share/gnome-shell/extensions/pwcalc@thilomaurer.de

DEPS=schemas/gschemas.compiled

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.pwcalc.gschema.xml
	glib-compile-schemas schemas/

release: $(DEPS)
	gnome-extensions pack --podir=po --force

localinstall: $(DEPS)
	mkdir -p $(INSTALLPATH)
	cp -r * $(INSTALLPATH)

