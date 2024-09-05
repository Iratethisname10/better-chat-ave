var mainKey = 'ShiftRight';
var mainKeyDown = false;

var modules = {};

var core;
var cmdAPI;

var onKeyDownMain;
var onKeyUpMain;
var onKeyDownModule;
var onInput;

var chatObserver;
var stopObserving;

var blacklistedWordsList;

const mainInputBox = document.getElementById('main_input_box');
const privInputBox = document.getElementById('private_input_box');

const privCloseButton = document.getElementById('private_close');

const chatLogContainer = document.getElementById('chat_logs_container');

class Module {
	constructor(id, bind, func) {
		this._bind = bind;
		this._func = func;
		this._name = id;
		this._active = true;
		this._originBind = bind;

		modules[this._name] = this;
	};
};

//	class ToastNotif {
//		constructor(title, contents, duration) {
//			this._title = title;
//			this._text = contents;
//			this._time = duration;
//		};
//
//		notif() {
//
//		};
//
//		succ() {
//
//		};
//
//		warn() {
//
//		};
//
//		err() {
//
//		};
//	};

class CommandAPI {
	__ThrowInvalidCommandError() {
		alert('Invalid command, type "cmds" for a list of commands.');
		core.openCommandBox();
	};

	__rebindUsage() {
		alert('Usage:\nrebind <module id> <new bind>\ne.g. rebind open-dms k');
	};

	cmds() {
		const propNames = Object.getOwnPropertyNames(CommandAPI.prototype);
		const funcs = propNames.filter(name => {
			return name !== 'constructor' && !name.startsWith('__') && typeof CommandAPI.prototype[name] === 'function';
		});

		alert('Commands:\n' + funcs.join('\n'));
	};

	modules() {
		let temp = [];

		for (const i in modules) {
			if (modules[i] && typeof modules[i] === 'object' && '_name' in modules[i]) {
				temp.push(`${modules[i]._name} (${modules[i]._bind})`);
			};
		};

		alert('Modules:\n' + temp.join('\n'))
	};

	// main cmds
	rebind(id, newBind) {
		if (!id) return cmdAPI.__rebindUsage();
		if (!newBind) return cmdAPI.__rebindUsage();

		modules[id]._bind = newBind.toUpperCase();

		alert(`Changed bind for ${id} from ${modules[id]._originBind} to ${newBind}`);
	};

	resetbinds() {
		for (const i in modules) {
			const module = modules[i];

			module._bind = module._originBind;
		};

		alert('Resetted all binds.');
	};
};

class CoreFunctions {
	print(text) {
		console.log('[better chat ave]:', text);
	};

	unload() {
		mainInputBox.removeEventListener('input', onInput);
		privInputBox.removeEventListener('input', onInput);

		document.removeEventListener('keydown', onKeyDownMain);
		document.removeEventListener('keyup', onKeyUpMain);
		document.removeEventListener('keydown', onKeyDownModule);

		stopObserving();

		for (const moduleName in modules) {
			modules[moduleName]._active = false;
		};
	};

	openCommandBox() {
		let input = prompt('Enter a command:');
		if (!input) return;

		let args = input.split(' ');
		if (args.length < 1) return;

		let command = cmdAPI[args[0].toLowerCase()];
		if (command == cmdAPI.__ThrowInvalidCommandError) return cmdAPI.__ThrowInvalidCommandError();
		if (!command) return cmdAPI.__ThrowInvalidCommandError();

		args.shift();

		command(...args);
	};
};

// do
(() => {
	new Module('open-dms', 'L', function() {
		getPrivate();
	});

	new Module('block', 'B', function() {
		ignoreThisUser();
		privCloseButton.click();
	});

	// misc modules
	new Module('unload', 'Delete', function() {
		core.unload();
		alert('better chat ave has been unloaded.');
	});

	new Module('open-cmd', 'Slash', function() {
		core.openCommandBox();
		mainKeyDown = false;
	});

	// no chat filter
	onInput = (event) => {
		const input = event.target;
		const currentVal = input.value;

		const backspace = event.inputType === 'deleteContentBackward';

		if (backspace && currentVal.length > 0) {
			input.value = currentVal.slice(0, -1);
		} else if (!currentVal.endsWith('‎')) {
			input.value = currentVal + '‎';
		};
	};

	mainInputBox.addEventListener('input', onInput);
	privInputBox.addEventListener('input', onInput);

	// anti spam bot (this is so sad)
	const sesstionTokenRegex = /^[0-9a-fA-F]+$/;
	const isSessionToken = (text) => {
		if (text.length !== 66) return [false, text];

		return [sesstionTokenRegex.test(text), text];
	};

	const hasSessionToken = (text) => {
		const words = text.split(' ');

		for (const word of words) {
			const [isBad, token] = isSessionToken(word);
			if (isBad) return token;
		};

		return null;
	};

	const containsBlacklisted = (text) => {
		for (const word of blacklistedWordsList) {
			if (text.includes(word)) return word;
		};

		const [isBad, _] = isSessionToken(text);
		if (isBad) return 'session token';

		if (hasSessionToken(text)) return 'session token';

		return null;
	};

	stopObserving = () => {
		observer.disconnect();
	};

	chatObserver = new MutationObserver((mutationsList) => {
		for (const mutation of mutationsList) {
			if (mutation.type === 'childList') {
				mutation.addedNodes.forEach(node => {
					if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'LI') {
						const msg = node.querySelector('.chat_message');
						const avs = node.querySelector('.avtrig.avs_menu.chat_avatar'); 

						if (avs) {
							const userId = avs.getAttribute('data-id');
						};

						if (msg) {
							const msgText = msg.textContent.trim().toLowerCase().replace(/[`'/.,:;_]/g, '');
							const detected = containsBlacklisted(msgText);
							if (detected) {
								node.remove();
								core.print(`removed: "${msgText}" due to: "${detected}"`);

								// if (userId) ignoreUser(Number(userId)); // make this a setting in the ui
							};

							// remove large blocks of text
							if (msgText.length >= 200)  {
								node.remove();
								core.print(`removed: "${msgText.slice(0, 70)}..." due to having more than 200 characters (${msgText.length})`);
							};
						};
					};
				});
			};
		};
	});

	chatObserver.observe(chatLogContainer, { childList: true, subtree: true });
})();

async function getList() {
	try {
		const response = await fetch('https://raw.githubusercontent.com/Iratethisname10/better-chat-ave/main/detections.json');
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

		const data = await response.json();
		blacklistedWordsList = data;
	} catch(err) {
		core.print(`failed to get list (${err}), disabling chat observer`);
		setTimeout(stopObserving, 2000);
	};
};

function init() {
	onKeyDownMain = (event) => {
		if (event.code === mainKey) mainKeyDown = true;
	};

	onKeyUpMain = (event) => {
		if (event.code === mainKey) mainKeyDown = false;
	};

	onKeyDownModule = (event) => {
		for (const i in modules) {
			const module = modules[i];

			const bindCode = module._bind.length > 1 ? module._bind : 'Key'.concat(module._bind);

			if (event.code === bindCode && module._active && mainKeyDown) {
				module._func();
			};
		};
	};

	core = new CoreFunctions();
	cmdAPI = new CommandAPI();

	document.addEventListener('keydown', onKeyDownMain);
	document.addEventListener('keyup', onKeyUpMain);
	document.addEventListener('keydown', onKeyDownModule);

	getList();

	core.print('Inited!');
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
};