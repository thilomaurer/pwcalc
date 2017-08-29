Password Calculator
==================

This Gnome Shell Extension calculates **strong passwords for each alias from your single secret**.

* No need to remember dozens of passwords any longer.
* No need for a password manager any longer.
* Full freedom in choosing aliases and secret, e.g.
  * alias: `username@google.com#2014`
  * secret: `saFe⚿in漢字`

Recent aliases are kept in a easily accessible drop-down.

![Password Calcualtor Screenshot](/screenshot.png?raw=true "A screenshot of the Password Calculator extension")

You may choose between two (incompatible) hash methods:

* [HMAC-SHA1](https://en.wikipedia.org/wiki/Hash-based_message_authentication_code) (default)  
  The formula is `(secret,alias) → HMAC_SHA1 → BASE64`
* simple [SHA1](https://en.wikipedia.org/wiki/SHA-1) (default for upgraders)  
  The formula is `"[secret][alias]" → SHA1 → BASE64`

You may choose between the following destinations for your password:

* Primary Selection (paste using middle mouse button)
* Clipboard (paste using Ctrl+V)
* Additional Copy Notification without password

