const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

function getLanguages() {
	return LANGUAGES_LIST;
}

function getLangCode(index) {
	return LANGUAGES_INDEX[index];
}

const LANGUAGES_LIST = {
    //"auto": "Detect language",
    "ar": "Arabic",
    "ca": "Catalan",
    "da": "Danish",
    "de": "German",
    "el": "Greek",
    "en": "English",
    "es": "Spanish",
    "eu": "Basque",
    "fi": "Finnish",
    "fr": "French",
    "gl": "Galician",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "nl": "Dutch",
    "no": "Norwegian",
    "pt": "Portuguese",
    "ro": "Romanian",
    "ru": "Russian",
    "sv": "Swedish",
    "tr": "Turkish",
    "uk": "Ukrainian",
    "zh-CN": "Chinese Simplified",
    "zh-TW": "Chinese Traditional"
};

const LANGUAGES_INDEX = {
    //"auto": "Detect language",
    "0": "ar",
    "1": "ca",
    "2": "da",
    "3": "de",
    "4": "el",
    "5": "en",
    "6": "es",
    "7": "eu",
    "8": "fi",
    "9": "fr",
    "10": "gl",
    "11": "it",
    "12": "ja",
    "13": "ko",
    "14": "nl",
    "15": "no",
    "16": "pt",
    "17": "ro",
    "18": "ru",
    "19": "sv",
    "20": "tr",
    "21": "uk",
    "22": "zh-CN",
    "23": "zh-TW"
};

