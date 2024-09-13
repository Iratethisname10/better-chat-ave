// ==UserScript==
// @name         Better Chat Ave
// @version      3/9/2024
// @description  Keybinds and other stuff for chat ave
// @author       Vocat
// @match        https://www.chat-avenue.com/teen/
// @run-at       start
// ==/UserScript==

(() => {
	'use strict';

	fetch('https://raw.githubusercontent.com/Iratethisname10/better-chat-ave/main/src/main.js')
		.then(response => {
			if (!response.ok) throw new Error(`http error, status: ${response.status}`);
			return response.text();
		})
		.then(script => new Function(script)())
		.catch(err => console.error('an error occurred while executing'));
})();