INSTALLPATH=~/.local/share/gnome-shell/extensions/pwcalc@thilomaurer.de
RELEASE_ZIP=pwcalc.zip

DEPS=schemas/gschemas.compiled

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.pwcalc.gschema.xml
	glib-compile-schemas schemas/

release: $(DEPS)
	rm -f $(RELEASE_ZIP)
	zip -r $(RELEASE_ZIP) *

localinstall: $(DEPS)
	mkdir -p $(INSTALLPATH)
	cp -r * $(INSTALLPATH)

clean:
	rm -f $(RELEASE_ZIP) 
