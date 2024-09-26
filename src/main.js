const config = [];
config.mainKey = 'ShiftRight'; // the main key for keybinds e.g. ShiftRight + B
config.chatBypass = true; // bypasses the chat filter
config.antiSpam = true; // attempts to remove spam or unwanted messages
config.logDetectedMessages = false; // logs detected messages to the console
config.blockDetectedPeople = false; // blocks people that have sent a unwanted message
config.removeLongMessages = false; // removes messages that are over 200 characters long

let hookStore = [];

const modules = {};

let mainKeyDown = false;
let blacklistedWordsList;
let stopObserving;

let core, cmdAPI, hooks;
let onKeyDownMain, onKeyUpMain, onKeyDownMisc, onInput, onKeyDown;

const mainInputBox = document.getElementById('main_input_box');
const privInputBox = document.getElementById('private_input_box');
const privCloseButton = document.getElementById('private_close');
const chatLogContainer = document.getElementById('chat_logs_container');
const chatRight = document.getElementById('chat_right');

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

class CommandAPI {
	__invalidCmd() {
		alert('Invalid command, type "cmds" for a list of commands.');
		core.openCommandBox();
	};

	__help(helpText) {
		alert(`Usage: \n${helpText}`);
		core.openCommandBox();
	};

	cmds() {
		const funcs = Object.getOwnPropertyNames(CommandAPI.prototype).filter(name => {
			return name !== 'constructor' && !name.startsWith('__') && typeof CommandAPI.prototype[name] === 'function';
		});

		alert('Commands:\n' + funcs.join('\n'));
	};

	modules() {
		const moduleList = Object.keys(modules).map(id => `${modules[id]._name} (${modules[id]._bind})`);
		alert('Modules:\n' + moduleList.join('\n'));
	};

	// main cmds
	rebind(id, newBind) {
		if (!id || !newBind) return cmdAPI.__help('rebind <module id> <new bind>\ne.g. rebind open-dms k');

		if (modules[id]) {
			modules[id]._bind = newBind.toUpperCase();
			alert(`Changed bind for ${id} from ${modules[id]._originBind} to ${newBind.toUpperCase()}`);
		};
	};

	resetbinds() {
		Object.values(modules).forEach(module => module._bind = module._originBind);
		alert('Resetted all binds.');
	};

	unblockall() {
		ignoreList.forEach(id => unIgnore(id));
	};

	country(code) {
		if (!code) return cmdAPI.__help('country <country code>\ne.g. country sg\ncountry code is not case sensitive.');

		if (chatRight.style.display !== 'table-cell') chatRight.style.display = 'table-cell';

		prepareRight(0);
		$.post('system/panel/user_list.php', {}, function(res) {
			$('#chat_right_data').html(res);
			firstPanel = '';

			document.querySelectorAll('#chat_right_data .user_item').forEach(item => {
				const country = item.getAttribute('data-country');
				if (country !== code.toUpperCase()) item.remove();
			});
			hooks.hookCloseRight();
		});
	};

	save(...message) {
		if (message.length < 1) return cmdAPI.__help('save <message to save>\ne.g. save hi dm if you like cheese.');

		const joinedMsg = message.join(' ');

		localStorage.setItem('bca_savedmsg', joinedMsg);
		core.print('saved: ' + joinedMsg)
	};

	clearsave() {
		localStorage.removeItem('bca_savedmsg');
	};
};

class Hooks {
	disableNotifs() {
		hookStore.oldNotif = callSaved;
		callSaved = () => {};
	};

	enableNotifs() {
		callSaved = hookStore.oldNotif;
	};

	hookCloseRight() {
		const oldCloseRight = closeRight;

		closeRight = () => {
			prepareRight(0);
			userReload(1);

			closeRight = oldCloseRight;
		};
	};
};

class CoreFunctions {
	print(text) {
		console.log('[better chat ave]:', text);
	};

	unload() {
		mainInputBox.removeEventListener('keydown', onKeyDown);
		mainInputBox.removeEventListener('input', onInput);
		privInputBox.removeEventListener('input', onInput);

		document.removeEventListener('keydown', onKeyDownMain);
		document.removeEventListener('keyup', onKeyUpMain);
		document.removeEventListener('keydown', onKeyDownModule);

		stopObserving();

		Object.values(modules).forEach(module => module._active = false);
		core.print('Unloaded!');
	};

	openCommandBox() {
		const input = prompt('Enter a command:');
		if (!input) return;

		const args = input.split(' ');
		if (args.length < 1) return;

		const command = cmdAPI[args[0].toLowerCase()];
		if (command == cmdAPI.__invalidCmd) return cmdAPI.__invalidCmd();
		if (!command) return cmdAPI.__invalidCmd();

		command(...args.slice(1));
	};
};

const initInputHook = () => {
	onInput = (event) => {
		if (!config.chatBypass) return;

		const input = event.target;
		const currentVal = input.value;

		const backspace = event.inputType === 'deleteContentBackward';

		if (backspace && currentVal.length > 0) {
			input.value = currentVal.slice(0, -1);
		} else if (!currentVal.endsWith('‎')) {
			input.value = currentVal + '‎';
		};
	};

	onKeyDown = (event) => {
		if (event.key !== 'ArrowUp') return;

		const savedMessage = localStorage.getItem('bca_savedmsg');
		if (!savedMessage) return;

		event.target.value = '';
		event.target.value = savedMessage;
	};

	mainInputBox.addEventListener('keydown', onKeyDown);
	mainInputBox.addEventListener('input', onInput);
	privInputBox.addEventListener('input', onInput);
	core.print('input hook inited!');
};

const initCharObserver = () => {
	const regex = /^[0-9a-fA-F]{66}$/;
	
	const isSessionToken = text => regex.test(text);
	const hasSessionToken = text => text.split(' ').some(isSessionToken);
	const hasBypassedCharacter = text => [...text].some(char => char.codePointAt(0) >= 0x1D400 && char.codePointAt(0) <= 0x1D7FF);

	const containsBlacklisted = (text) => {
		const foundWord = blacklistedWordsList.find(word => text.includes(word));
		if (foundWord) return foundWord;

		if (hasSessionToken(text)) return 'session token';
		if (hasBypassedCharacter(text)) return 'bypassed text';

		return null;
	};

	stopObserving = () => chatObserver.disconnect();

	chatObserver = new MutationObserver((mutationsList) => {
		for (const mutation of mutationsList) {
			if (mutation.type === 'childList') {
				mutation.addedNodes.forEach(node => {
					if (config.antiSpam && node.nodeType === Node.ELEMENT_NODE && node.tagName === 'LI') {
						const msg = node.querySelector('.chat_message');
						const avs = node.querySelector('.avtrig.avs_menu.chat_avatar'); 

						const userId = avs ? avs.getAttribute('data-id') : null;

						if (msg) {
							const msgText = msg.textContent.trim().toLowerCase().replace(/[`'/.,:;_]/g, '');
							const detected = containsBlacklisted(msgText);
							if (detected) {
								node.remove();
								if (config.logDetectedMessages) core.print(`removed: "${msgText}" due to: "${detected}"`);

								if (userId && config.blockDetectedPeople) {
									hooks.disableNotifs();
									setTimeout(hooks.enableNotifs, 400);

									ignoreUser(Number(userId));
								};
							};

							if (msgText.length >= 200 && config.removeLongMessages)  {
								node.remove();
								if (config.logDetectedMessages) core.print(`removed: "${msgText.slice(0, 50)}..." due to having more than 200 characters (${msgText.length})`);

								if (userId && config.blockDetectedPeople) {
									hooks.disableNotifs();
									setTimeout(hooks.enableNotifs, 400);

									ignoreUser(Number(userId));
								};
							};
						};
					};
				});
			};
		};
	});

	chatObserver.observe(chatLogContainer, { childList: true, subtree: true });
	core.print('Chat observer inited!');
};

// modules
(() => {
	new Module('open-dms', 'L', function() {
		getPrivate();
	});

	new Module('block', 'B', function() {
		ignoreThisUser();
		privCloseButton?.click();
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
})();

const init = async () => {
	onKeyDownMain = (event) => {
		if (event.code === config.mainKey) mainKeyDown = true;
	};

	onKeyUpMain = (event) => {
		if (event.code === config.mainKey) mainKeyDown = false;
	};

	onKeyDownMisc = (event) => {
		for (const i in modules) {
			const module = modules[i];
			const bindCode = module._bind.length > 1 ? module._bind : 'Key'.concat(module._bind);

			if (event.code === bindCode && module._active && mainKeyDown) {
				module._func();
			};
		};
	};

	getList = async () => {
		try {
			const response = await fetch('https://raw.githubusercontent.com/Iratethisname10/better-chat-ave/main/detections.json');
			if (!response.ok) throw new Error(`http error, status: ${response.status}`);

			blacklistedWordsList = await response.json();
		} catch(err) {
			core.print(`failed to get list (${err.message}), disabling chat observer.`);
			stopObserving();
		};
	};

	core = new CoreFunctions();
	cmdAPI = new CommandAPI();
	hooks = new Hooks();

	hooks.disableNotifs();

	document.addEventListener('keydown', onKeyDownMain);
	document.addEventListener('keyup', onKeyUpMain);
	document.addEventListener('keydown', onKeyDownMisc);

	getList();

	initInputHook();
	initCharObserver();

	core.print('Script inited!');
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
};