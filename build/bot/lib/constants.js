"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
var FINISH_WORD = exports.FINISH_WORD = {
	word: "done",
	reg_exp: new RegExp(/^[done]{3,}e$/i)
};

var NONE = exports.NONE = {
	word: "none",
	reg_exp: new RegExp(/^[none]{3,}e$/i)
};

var THANK_YOU = exports.THANK_YOU = {
	word: "thank you",
	reg_exp: new RegExp(/(^[thanksyou]{5,}\b|^[thx]{3,5}\b|^[ty]{2,3}\b)/i)
};

var EXIT_EARLY_WORDS = exports.EXIT_EARLY_WORDS = ['exit', 'stop', 'never mind', 'quit'];

var colorsHash = exports.colorsHash = {
	green: {
		hex: "#36a64f"
	},
	darkBlue: {
		hex: "#000057"
	},
	salmon: {
		hex: "#bb4444"
	},
	lavendar: {
		hex: "6e4474"
	},
	turquoise: {
		hex: "#44bbbb"
	}
};

var colorsArray = [];
for (var key in colorsHash) {
	colorsArray.push({
		title: key,
		hex: colorsHash[key].hex
	});
}
exports.colorsArray = colorsArray;
var buttonValues = exports.buttonValues = {
	startNow: {
		name: "START_NOW",
		value: "START_NOW"
	},
	checkIn: {
		name: "CHECK_IN",
		value: "CHECK_IN"
	},
	changeTask: {
		name: "CHANGE_TASK",
		value: "CHANGE_TASK"
	},
	changeTime: {
		name: "CHANGE_TIME",
		value: "CHANGE_TIME"
	}
};
//# sourceMappingURL=constants.js.map