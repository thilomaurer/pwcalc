INSTALLPATH=~/.local/share/gnome-shell/extensions/pwcalc@thilomaurer.de
TARGET=pwcalc.zip

release:
	rm -f $(TARGET)
	zip -r $(TARGET) *

localinstall:
	mkdir -p $(INSTALLPATH)
	cp -r * $(INSTALLPATH)

