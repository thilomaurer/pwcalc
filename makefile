release:
	rm -f pwcalc.zip
	zip -r pwcalc.zip *

localinstall:
	cp -r * ~/.local/share/gnome-shell/extensions/pwcalc@thilomaurer.de

