var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/prismjs/prism.js
var require_prism = __commonJS({
  "node_modules/prismjs/prism.js"(exports, module) {
    var _self = typeof window !== "undefined" ? window : typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope ? self : {};
    var Prism3 = (function(_self2) {
      var lang = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i;
      var uniqueId = 0;
      var plainTextGrammar = {};
      var _ = {
        /**
         * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
         * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
         * additional languages or plugins yourself.
         *
         * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
         *
         * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
         * empty Prism object into the global scope before loading the Prism script like this:
         *
         * ```js
         * window.Prism = window.Prism || {};
         * Prism.manual = true;
         * // add a new <script> to load Prism's script
         * ```
         *
         * @default false
         * @type {boolean}
         * @memberof Prism
         * @public
         */
        manual: _self2.Prism && _self2.Prism.manual,
        /**
         * By default, if Prism is in a web worker, it assumes that it is in a worker it created itself, so it uses
         * `addEventListener` to communicate with its parent instance. However, if you're using Prism manually in your
         * own worker, you don't want it to do this.
         *
         * By setting this value to `true`, Prism will not add its own listeners to the worker.
         *
         * You obviously have to change this value before Prism executes. To do this, you can add an
         * empty Prism object into the global scope before loading the Prism script like this:
         *
         * ```js
         * window.Prism = window.Prism || {};
         * Prism.disableWorkerMessageHandler = true;
         * // Load Prism's script
         * ```
         *
         * @default false
         * @type {boolean}
         * @memberof Prism
         * @public
         */
        disableWorkerMessageHandler: _self2.Prism && _self2.Prism.disableWorkerMessageHandler,
        /**
         * A namespace for utility methods.
         *
         * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
         * change or disappear at any time.
         *
         * @namespace
         * @memberof Prism
         */
        util: {
          encode: function encode(tokens) {
            if (tokens instanceof Token) {
              return new Token(tokens.type, encode(tokens.content), tokens.alias);
            } else if (Array.isArray(tokens)) {
              return tokens.map(encode);
            } else {
              return tokens.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\u00a0/g, " ");
            }
          },
          /**
           * Returns the name of the type of the given value.
           *
           * @param {any} o
           * @returns {string}
           * @example
           * type(null)      === 'Null'
           * type(undefined) === 'Undefined'
           * type(123)       === 'Number'
           * type('foo')     === 'String'
           * type(true)      === 'Boolean'
           * type([1, 2])    === 'Array'
           * type({})        === 'Object'
           * type(String)    === 'Function'
           * type(/abc+/)    === 'RegExp'
           */
          type: function(o) {
            return Object.prototype.toString.call(o).slice(8, -1);
          },
          /**
           * Returns a unique number for the given object. Later calls will still return the same number.
           *
           * @param {Object} obj
           * @returns {number}
           */
          objId: function(obj) {
            if (!obj["__id"]) {
              Object.defineProperty(obj, "__id", { value: ++uniqueId });
            }
            return obj["__id"];
          },
          /**
           * Creates a deep clone of the given object.
           *
           * The main intended use of this function is to clone language definitions.
           *
           * @param {T} o
           * @param {Record<number, any>} [visited]
           * @returns {T}
           * @template T
           */
          clone: function deepClone(o, visited) {
            visited = visited || {};
            var clone;
            var id;
            switch (_.util.type(o)) {
              case "Object":
                id = _.util.objId(o);
                if (visited[id]) {
                  return visited[id];
                }
                clone = /** @type {Record<string, any>} */
                {};
                visited[id] = clone;
                for (var key in o) {
                  if (o.hasOwnProperty(key)) {
                    clone[key] = deepClone(o[key], visited);
                  }
                }
                return (
                  /** @type {any} */
                  clone
                );
              case "Array":
                id = _.util.objId(o);
                if (visited[id]) {
                  return visited[id];
                }
                clone = [];
                visited[id] = clone;
                /** @type {Array} */
                /** @type {any} */
                o.forEach(function(v, i) {
                  clone[i] = deepClone(v, visited);
                });
                return (
                  /** @type {any} */
                  clone
                );
              default:
                return o;
            }
          },
          /**
           * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
           *
           * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
           *
           * @param {Element} element
           * @returns {string}
           */
          getLanguage: function(element) {
            while (element) {
              var m = lang.exec(element.className);
              if (m) {
                return m[1].toLowerCase();
              }
              element = element.parentElement;
            }
            return "none";
          },
          /**
           * Sets the Prism `language-xxxx` class of the given element.
           *
           * @param {Element} element
           * @param {string} language
           * @returns {void}
           */
          setLanguage: function(element, language) {
            element.className = element.className.replace(RegExp(lang, "gi"), "");
            element.classList.add("language-" + language);
          },
          /**
           * Returns the script element that is currently executing.
           *
           * This does __not__ work for line script element.
           *
           * @returns {HTMLScriptElement | null}
           */
          currentScript: function() {
            if (typeof document === "undefined") {
              return null;
            }
            if (document.currentScript && document.currentScript.tagName === "SCRIPT" && 1 < 2) {
              return (
                /** @type {any} */
                document.currentScript
              );
            }
            try {
              throw new Error();
            } catch (err) {
              var src = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(err.stack) || [])[1];
              if (src) {
                var scripts = document.getElementsByTagName("script");
                for (var i in scripts) {
                  if (scripts[i].src == src) {
                    return scripts[i];
                  }
                }
              }
              return null;
            }
          },
          /**
           * Returns whether a given class is active for `element`.
           *
           * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
           * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
           * given class is just the given class with a `no-` prefix.
           *
           * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
           * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
           * ancestors have the given class or the negated version of it, then the default activation will be returned.
           *
           * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
           * version of it, the class is considered active.
           *
           * @param {Element} element
           * @param {string} className
           * @param {boolean} [defaultActivation=false]
           * @returns {boolean}
           */
          isActive: function(element, className, defaultActivation) {
            var no = "no-" + className;
            while (element) {
              var classList = element.classList;
              if (classList.contains(className)) {
                return true;
              }
              if (classList.contains(no)) {
                return false;
              }
              element = element.parentElement;
            }
            return !!defaultActivation;
          }
        },
        /**
         * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
         *
         * @namespace
         * @memberof Prism
         * @public
         */
        languages: {
          /**
           * The grammar for plain, unformatted text.
           */
          plain: plainTextGrammar,
          plaintext: plainTextGrammar,
          text: plainTextGrammar,
          txt: plainTextGrammar,
          /**
           * Creates a deep copy of the language with the given id and appends the given tokens.
           *
           * If a token in `redef` also appears in the copied language, then the existing token in the copied language
           * will be overwritten at its original position.
           *
           * ## Best practices
           *
           * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
           * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
           * understand the language definition because, normally, the order of tokens matters in Prism grammars.
           *
           * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
           * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
           *
           * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
           * @param {Grammar} redef The new tokens to append.
           * @returns {Grammar} The new language created.
           * @public
           * @example
           * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
           *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
           *     // at its original position
           *     'comment': { ... },
           *     // CSS doesn't have a 'color' token, so this token will be appended
           *     'color': /\b(?:red|green|blue)\b/
           * });
           */
          extend: function(id, redef) {
            var lang2 = _.util.clone(_.languages[id]);
            for (var key in redef) {
              lang2[key] = redef[key];
            }
            return lang2;
          },
          /**
           * Inserts tokens _before_ another token in a language definition or any other grammar.
           *
           * ## Usage
           *
           * This helper method makes it easy to modify existing languages. For example, the CSS language definition
           * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
           * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
           * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
           * this:
           *
           * ```js
           * Prism.languages.markup.style = {
           *     // token
           * };
           * ```
           *
           * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
           * before existing tokens. For the CSS example above, you would use it like this:
           *
           * ```js
           * Prism.languages.insertBefore('markup', 'cdata', {
           *     'style': {
           *         // token
           *     }
           * });
           * ```
           *
           * ## Special cases
           *
           * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
           * will be ignored.
           *
           * This behavior can be used to insert tokens after `before`:
           *
           * ```js
           * Prism.languages.insertBefore('markup', 'comment', {
           *     'comment': Prism.languages.markup.comment,
           *     // tokens after 'comment'
           * });
           * ```
           *
           * ## Limitations
           *
           * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
           * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
           * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
           * deleting properties which is necessary to insert at arbitrary positions.
           *
           * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
           * Instead, it will create a new object and replace all references to the target object with the new one. This
           * can be done without temporarily deleting properties, so the iteration order is well-defined.
           *
           * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
           * you hold the target object in a variable, then the value of the variable will not change.
           *
           * ```js
           * var oldMarkup = Prism.languages.markup;
           * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
           *
           * assert(oldMarkup !== Prism.languages.markup);
           * assert(newMarkup === Prism.languages.markup);
           * ```
           *
           * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
           * object to be modified.
           * @param {string} before The key to insert before.
           * @param {Grammar} insert An object containing the key-value pairs to be inserted.
           * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
           * object to be modified.
           *
           * Defaults to `Prism.languages`.
           * @returns {Grammar} The new grammar object.
           * @public
           */
          insertBefore: function(inside, before, insert, root) {
            root = root || /** @type {any} */
            _.languages;
            var grammar = root[inside];
            var ret = {};
            for (var token in grammar) {
              if (grammar.hasOwnProperty(token)) {
                if (token == before) {
                  for (var newToken in insert) {
                    if (insert.hasOwnProperty(newToken)) {
                      ret[newToken] = insert[newToken];
                    }
                  }
                }
                if (!insert.hasOwnProperty(token)) {
                  ret[token] = grammar[token];
                }
              }
            }
            var old = root[inside];
            root[inside] = ret;
            _.languages.DFS(_.languages, function(key, value) {
              if (value === old && key != inside) {
                this[key] = ret;
              }
            });
            return ret;
          },
          // Traverse a language definition with Depth First Search
          DFS: function DFS(o, callback, type, visited) {
            visited = visited || {};
            var objId = _.util.objId;
            for (var i in o) {
              if (o.hasOwnProperty(i)) {
                callback.call(o, i, o[i], type || i);
                var property = o[i];
                var propertyType = _.util.type(property);
                if (propertyType === "Object" && !visited[objId(property)]) {
                  visited[objId(property)] = true;
                  DFS(property, callback, null, visited);
                } else if (propertyType === "Array" && !visited[objId(property)]) {
                  visited[objId(property)] = true;
                  DFS(property, callback, i, visited);
                }
              }
            }
          }
        },
        plugins: {},
        /**
         * This is the most high-level function in Prism’s API.
         * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
         * each one of them.
         *
         * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
         *
         * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
         * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
         * @memberof Prism
         * @public
         */
        highlightAll: function(async, callback) {
          _.highlightAllUnder(document, async, callback);
        },
        /**
         * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
         * {@link Prism.highlightElement} on each one of them.
         *
         * The following hooks will be run:
         * 1. `before-highlightall`
         * 2. `before-all-elements-highlight`
         * 3. All hooks of {@link Prism.highlightElement} for each element.
         *
         * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
         * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
         * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
         * @memberof Prism
         * @public
         */
        highlightAllUnder: function(container, async, callback) {
          var env = {
            callback,
            container,
            selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
          };
          _.hooks.run("before-highlightall", env);
          env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));
          _.hooks.run("before-all-elements-highlight", env);
          for (var i = 0, element; element = env.elements[i++]; ) {
            _.highlightElement(element, async === true, env.callback);
          }
        },
        /**
         * Highlights the code inside a single element.
         *
         * The following hooks will be run:
         * 1. `before-sanity-check`
         * 2. `before-highlight`
         * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
         * 4. `before-insert`
         * 5. `after-highlight`
         * 6. `complete`
         *
         * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
         * the element's language.
         *
         * @param {Element} element The element containing the code.
         * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
         * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
         * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
         * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
         *
         * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
         * asynchronous highlighting to work. You can build your own bundle on the
         * [Download page](https://prismjs.com/download.html).
         * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
         * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
         * @memberof Prism
         * @public
         */
        highlightElement: function(element, async, callback) {
          var language = _.util.getLanguage(element);
          var grammar = _.languages[language];
          _.util.setLanguage(element, language);
          var parent = element.parentElement;
          if (parent && parent.nodeName.toLowerCase() === "pre") {
            _.util.setLanguage(parent, language);
          }
          var code = element.textContent;
          var env = {
            element,
            language,
            grammar,
            code
          };
          function insertHighlightedCode(highlightedCode) {
            env.highlightedCode = highlightedCode;
            _.hooks.run("before-insert", env);
            env.element.innerHTML = env.highlightedCode;
            _.hooks.run("after-highlight", env);
            _.hooks.run("complete", env);
            callback && callback.call(env.element);
          }
          _.hooks.run("before-sanity-check", env);
          parent = env.element.parentElement;
          if (parent && parent.nodeName.toLowerCase() === "pre" && !parent.hasAttribute("tabindex")) {
            parent.setAttribute("tabindex", "0");
          }
          if (!env.code) {
            _.hooks.run("complete", env);
            callback && callback.call(env.element);
            return;
          }
          _.hooks.run("before-highlight", env);
          if (!env.grammar) {
            insertHighlightedCode(_.util.encode(env.code));
            return;
          }
          if (async && _self2.Worker) {
            var worker = new Worker(_.filename);
            worker.onmessage = function(evt) {
              insertHighlightedCode(evt.data);
            };
            worker.postMessage(JSON.stringify({
              language: env.language,
              code: env.code,
              immediateClose: true
            }));
          } else {
            insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
          }
        },
        /**
         * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
         * and the language definitions to use, and returns a string with the HTML produced.
         *
         * The following hooks will be run:
         * 1. `before-tokenize`
         * 2. `after-tokenize`
         * 3. `wrap`: On each {@link Token}.
         *
         * @param {string} text A string with the code to be highlighted.
         * @param {Grammar} grammar An object containing the tokens to use.
         *
         * Usually a language definition like `Prism.languages.markup`.
         * @param {string} language The name of the language definition passed to `grammar`.
         * @returns {string} The highlighted HTML.
         * @memberof Prism
         * @public
         * @example
         * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
         */
        highlight: function(text, grammar, language) {
          var env = {
            code: text,
            grammar,
            language
          };
          _.hooks.run("before-tokenize", env);
          if (!env.grammar) {
            throw new Error('The language "' + env.language + '" has no grammar.');
          }
          env.tokens = _.tokenize(env.code, env.grammar);
          _.hooks.run("after-tokenize", env);
          return Token.stringify(_.util.encode(env.tokens), env.language);
        },
        /**
         * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
         * and the language definitions to use, and returns an array with the tokenized code.
         *
         * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
         *
         * This method could be useful in other contexts as well, as a very crude parser.
         *
         * @param {string} text A string with the code to be highlighted.
         * @param {Grammar} grammar An object containing the tokens to use.
         *
         * Usually a language definition like `Prism.languages.markup`.
         * @returns {TokenStream} An array of strings and tokens, a token stream.
         * @memberof Prism
         * @public
         * @example
         * let code = `var foo = 0;`;
         * let tokens = Prism.tokenize(code, Prism.languages.javascript);
         * tokens.forEach(token => {
         *     if (token instanceof Prism.Token && token.type === 'number') {
         *         console.log(`Found numeric literal: ${token.content}`);
         *     }
         * });
         */
        tokenize: function(text, grammar) {
          var rest = grammar.rest;
          if (rest) {
            for (var token in rest) {
              grammar[token] = rest[token];
            }
            delete grammar.rest;
          }
          var tokenList = new LinkedList();
          addAfter(tokenList, tokenList.head, text);
          matchGrammar(text, tokenList, grammar, tokenList.head, 0);
          return toArray(tokenList);
        },
        /**
         * @namespace
         * @memberof Prism
         * @public
         */
        hooks: {
          all: {},
          /**
           * Adds the given callback to the list of callbacks for the given hook.
           *
           * The callback will be invoked when the hook it is registered for is run.
           * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
           *
           * One callback function can be registered to multiple hooks and the same hook multiple times.
           *
           * @param {string} name The name of the hook.
           * @param {HookCallback} callback The callback function which is given environment variables.
           * @public
           */
          add: function(name, callback) {
            var hooks = _.hooks.all;
            hooks[name] = hooks[name] || [];
            hooks[name].push(callback);
          },
          /**
           * Runs a hook invoking all registered callbacks with the given environment variables.
           *
           * Callbacks will be invoked synchronously and in the order in which they were registered.
           *
           * @param {string} name The name of the hook.
           * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
           * @public
           */
          run: function(name, env) {
            var callbacks = _.hooks.all[name];
            if (!callbacks || !callbacks.length) {
              return;
            }
            for (var i = 0, callback; callback = callbacks[i++]; ) {
              callback(env);
            }
          }
        },
        Token
      };
      _self2.Prism = _;
      function Token(type, content, alias, matchedStr) {
        this.type = type;
        this.content = content;
        this.alias = alias;
        this.length = (matchedStr || "").length | 0;
      }
      Token.stringify = function stringify(o, language) {
        if (typeof o == "string") {
          return o;
        }
        if (Array.isArray(o)) {
          var s = "";
          o.forEach(function(e) {
            s += stringify(e, language);
          });
          return s;
        }
        var env = {
          type: o.type,
          content: stringify(o.content, language),
          tag: "span",
          classes: ["token", o.type],
          attributes: {},
          language
        };
        var aliases = o.alias;
        if (aliases) {
          if (Array.isArray(aliases)) {
            Array.prototype.push.apply(env.classes, aliases);
          } else {
            env.classes.push(aliases);
          }
        }
        _.hooks.run("wrap", env);
        var attributes = "";
        for (var name in env.attributes) {
          attributes += " " + name + '="' + (env.attributes[name] || "").replace(/"/g, "&quot;") + '"';
        }
        return "<" + env.tag + ' class="' + env.classes.join(" ") + '"' + attributes + ">" + env.content + "</" + env.tag + ">";
      };
      function matchPattern(pattern, pos, text, lookbehind) {
        pattern.lastIndex = pos;
        var match = pattern.exec(text);
        if (match && lookbehind && match[1]) {
          var lookbehindLength = match[1].length;
          match.index += lookbehindLength;
          match[0] = match[0].slice(lookbehindLength);
        }
        return match;
      }
      function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
        for (var token in grammar) {
          if (!grammar.hasOwnProperty(token) || !grammar[token]) {
            continue;
          }
          var patterns = grammar[token];
          patterns = Array.isArray(patterns) ? patterns : [patterns];
          for (var j = 0; j < patterns.length; ++j) {
            if (rematch && rematch.cause == token + "," + j) {
              return;
            }
            var patternObj = patterns[j];
            var inside = patternObj.inside;
            var lookbehind = !!patternObj.lookbehind;
            var greedy = !!patternObj.greedy;
            var alias = patternObj.alias;
            if (greedy && !patternObj.pattern.global) {
              var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
              patternObj.pattern = RegExp(patternObj.pattern.source, flags + "g");
            }
            var pattern = patternObj.pattern || patternObj;
            for (var currentNode = startNode.next, pos = startPos; currentNode !== tokenList.tail; pos += currentNode.value.length, currentNode = currentNode.next) {
              if (rematch && pos >= rematch.reach) {
                break;
              }
              var str = currentNode.value;
              if (tokenList.length > text.length) {
                return;
              }
              if (str instanceof Token) {
                continue;
              }
              var removeCount = 1;
              var match;
              if (greedy) {
                match = matchPattern(pattern, pos, text, lookbehind);
                if (!match || match.index >= text.length) {
                  break;
                }
                var from = match.index;
                var to = match.index + match[0].length;
                var p = pos;
                p += currentNode.value.length;
                while (from >= p) {
                  currentNode = currentNode.next;
                  p += currentNode.value.length;
                }
                p -= currentNode.value.length;
                pos = p;
                if (currentNode.value instanceof Token) {
                  continue;
                }
                for (var k = currentNode; k !== tokenList.tail && (p < to || typeof k.value === "string"); k = k.next) {
                  removeCount++;
                  p += k.value.length;
                }
                removeCount--;
                str = text.slice(pos, p);
                match.index -= pos;
              } else {
                match = matchPattern(pattern, 0, str, lookbehind);
                if (!match) {
                  continue;
                }
              }
              var from = match.index;
              var matchStr = match[0];
              var before = str.slice(0, from);
              var after = str.slice(from + matchStr.length);
              var reach = pos + str.length;
              if (rematch && reach > rematch.reach) {
                rematch.reach = reach;
              }
              var removeFrom = currentNode.prev;
              if (before) {
                removeFrom = addAfter(tokenList, removeFrom, before);
                pos += before.length;
              }
              removeRange(tokenList, removeFrom, removeCount);
              var wrapped = new Token(token, inside ? _.tokenize(matchStr, inside) : matchStr, alias, matchStr);
              currentNode = addAfter(tokenList, removeFrom, wrapped);
              if (after) {
                addAfter(tokenList, currentNode, after);
              }
              if (removeCount > 1) {
                var nestedRematch = {
                  cause: token + "," + j,
                  reach
                };
                matchGrammar(text, tokenList, grammar, currentNode.prev, pos, nestedRematch);
                if (rematch && nestedRematch.reach > rematch.reach) {
                  rematch.reach = nestedRematch.reach;
                }
              }
            }
          }
        }
      }
      function LinkedList() {
        var head = { value: null, prev: null, next: null };
        var tail = { value: null, prev: head, next: null };
        head.next = tail;
        this.head = head;
        this.tail = tail;
        this.length = 0;
      }
      function addAfter(list, node, value) {
        var next = node.next;
        var newNode = { value, prev: node, next };
        node.next = newNode;
        next.prev = newNode;
        list.length++;
        return newNode;
      }
      function removeRange(list, node, count) {
        var next = node.next;
        for (var i = 0; i < count && next !== list.tail; i++) {
          next = next.next;
        }
        node.next = next;
        next.prev = node;
        list.length -= i;
      }
      function toArray(list) {
        var array = [];
        var node = list.head.next;
        while (node !== list.tail) {
          array.push(node.value);
          node = node.next;
        }
        return array;
      }
      if (!_self2.document) {
        if (!_self2.addEventListener) {
          return _;
        }
        if (!_.disableWorkerMessageHandler) {
          _self2.addEventListener("message", function(evt) {
            var message = JSON.parse(evt.data);
            var lang2 = message.language;
            var code = message.code;
            var immediateClose = message.immediateClose;
            _self2.postMessage(_.highlight(code, _.languages[lang2], lang2));
            if (immediateClose) {
              _self2.close();
            }
          }, false);
        }
        return _;
      }
      var script = _.util.currentScript();
      if (script) {
        _.filename = script.src;
        if (script.hasAttribute("data-manual")) {
          _.manual = true;
        }
      }
      function highlightAutomaticallyCallback() {
        if (!_.manual) {
          _.highlightAll();
        }
      }
      if (!_.manual) {
        var readyState = document.readyState;
        if (readyState === "loading" || readyState === "interactive" && script && script.defer) {
          document.addEventListener("DOMContentLoaded", highlightAutomaticallyCallback);
        } else {
          if (window.requestAnimationFrame) {
            window.requestAnimationFrame(highlightAutomaticallyCallback);
          } else {
            window.setTimeout(highlightAutomaticallyCallback, 16);
          }
        }
      }
      return _;
    })(_self);
    if (typeof module !== "undefined" && module.exports) {
      module.exports = Prism3;
    }
    if (typeof globalThis !== "undefined") {
      globalThis.Prism = Prism3;
    }
    Prism3.languages.markup = {
      "comment": {
        pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
        greedy: true
      },
      "prolog": {
        pattern: /<\?[\s\S]+?\?>/,
        greedy: true
      },
      "doctype": {
        // https://www.w3.org/TR/xml/#NT-doctypedecl
        pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
        greedy: true,
        inside: {
          "internal-subset": {
            pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
            lookbehind: true,
            greedy: true,
            inside: null
            // see below
          },
          "string": {
            pattern: /"[^"]*"|'[^']*'/,
            greedy: true
          },
          "punctuation": /^<!|>$|[[\]]/,
          "doctype-tag": /^DOCTYPE/i,
          "name": /[^\s<>'"]+/
        }
      },
      "cdata": {
        pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
        greedy: true
      },
      "tag": {
        pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
        greedy: true,
        inside: {
          "tag": {
            pattern: /^<\/?[^\s>\/]+/,
            inside: {
              "punctuation": /^<\/?/,
              "namespace": /^[^\s>\/:]+:/
            }
          },
          "special-attr": [],
          "attr-value": {
            pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
            inside: {
              "punctuation": [
                {
                  pattern: /^=/,
                  alias: "attr-equals"
                },
                {
                  pattern: /^(\s*)["']|["']$/,
                  lookbehind: true
                }
              ]
            }
          },
          "punctuation": /\/?>/,
          "attr-name": {
            pattern: /[^\s>\/]+/,
            inside: {
              "namespace": /^[^\s>\/:]+:/
            }
          }
        }
      },
      "entity": [
        {
          pattern: /&[\da-z]{1,8};/i,
          alias: "named-entity"
        },
        /&#x?[\da-f]{1,8};/i
      ]
    };
    Prism3.languages.markup["tag"].inside["attr-value"].inside["entity"] = Prism3.languages.markup["entity"];
    Prism3.languages.markup["doctype"].inside["internal-subset"].inside = Prism3.languages.markup;
    Prism3.hooks.add("wrap", function(env) {
      if (env.type === "entity") {
        env.attributes["title"] = env.content.replace(/&amp;/, "&");
      }
    });
    Object.defineProperty(Prism3.languages.markup.tag, "addInlined", {
      /**
       * Adds an inlined language to markup.
       *
       * An example of an inlined language is CSS with `<style>` tags.
       *
       * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
       * case insensitive.
       * @param {string} lang The language key.
       * @example
       * addInlined('style', 'css');
       */
      value: function addInlined2(tagName, lang) {
        var includedCdataInside = {};
        includedCdataInside["language-" + lang] = {
          pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
          lookbehind: true,
          inside: Prism3.languages[lang]
        };
        includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;
        var inside = {
          "included-cdata": {
            pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
            inside: includedCdataInside
          }
        };
        inside["language-" + lang] = {
          pattern: /[\s\S]+/,
          inside: Prism3.languages[lang]
        };
        var def = {};
        def[tagName] = {
          pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
            return tagName;
          }), "i"),
          lookbehind: true,
          greedy: true,
          inside
        };
        Prism3.languages.insertBefore("markup", "cdata", def);
      }
    });
    Object.defineProperty(Prism3.languages.markup.tag, "addAttribute", {
      /**
       * Adds an pattern to highlight languages embedded in HTML attributes.
       *
       * An example of an inlined language is CSS with `style` attributes.
       *
       * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
       * case insensitive.
       * @param {string} lang The language key.
       * @example
       * addAttribute('style', 'css');
       */
      value: function(attrName, lang) {
        Prism3.languages.markup.tag.inside["special-attr"].push({
          pattern: RegExp(
            /(^|["'\s])/.source + "(?:" + attrName + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
            "i"
          ),
          lookbehind: true,
          inside: {
            "attr-name": /^[^\s=]+/,
            "attr-value": {
              pattern: /=[\s\S]+/,
              inside: {
                "value": {
                  pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
                  lookbehind: true,
                  alias: [lang, "language-" + lang],
                  inside: Prism3.languages[lang]
                },
                "punctuation": [
                  {
                    pattern: /^=/,
                    alias: "attr-equals"
                  },
                  /"|'/
                ]
              }
            }
          }
        });
      }
    });
    Prism3.languages.html = Prism3.languages.markup;
    Prism3.languages.mathml = Prism3.languages.markup;
    Prism3.languages.svg = Prism3.languages.markup;
    Prism3.languages.xml = Prism3.languages.extend("markup", {});
    Prism3.languages.ssml = Prism3.languages.xml;
    Prism3.languages.atom = Prism3.languages.xml;
    Prism3.languages.rss = Prism3.languages.xml;
    (function(Prism4) {
      var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
      Prism4.languages.css = {
        "comment": /\/\*[\s\S]*?\*\//,
        "atrule": {
          pattern: RegExp("@[\\w-](?:" + /[^;{\s"']|\s+(?!\s)/.source + "|" + string.source + ")*?" + /(?:;|(?=\s*\{))/.source),
          inside: {
            "rule": /^@[\w-]+/,
            "selector-function-argument": {
              pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
              lookbehind: true,
              alias: "selector"
            },
            "keyword": {
              pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
              lookbehind: true
            }
            // See rest below
          }
        },
        "url": {
          // https://drafts.csswg.org/css-values-3/#urls
          pattern: RegExp("\\burl\\((?:" + string.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)", "i"),
          greedy: true,
          inside: {
            "function": /^url/i,
            "punctuation": /^\(|\)$/,
            "string": {
              pattern: RegExp("^" + string.source + "$"),
              alias: "url"
            }
          }
        },
        "selector": {
          pattern: RegExp(`(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + string.source + ")*(?=\\s*\\{)"),
          lookbehind: true
        },
        "string": {
          pattern: string,
          greedy: true
        },
        "property": {
          pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
          lookbehind: true
        },
        "important": /!important\b/i,
        "function": {
          pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
          lookbehind: true
        },
        "punctuation": /[(){};:,]/
      };
      Prism4.languages.css["atrule"].inside.rest = Prism4.languages.css;
      var markup = Prism4.languages.markup;
      if (markup) {
        markup.tag.addInlined("style", "css");
        markup.tag.addAttribute("style", "css");
      }
    })(Prism3);
    Prism3.languages.clike = {
      "comment": [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: true,
          greedy: true
        }
      ],
      "string": {
        pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      "class-name": {
        pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
        lookbehind: true,
        inside: {
          "punctuation": /[.\\]/
        }
      },
      "keyword": /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
      "boolean": /\b(?:false|true)\b/,
      "function": /\b\w+(?=\()/,
      "number": /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
      "operator": /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
      "punctuation": /[{}[\];(),.:]/
    };
    Prism3.languages.javascript = Prism3.languages.extend("clike", {
      "class-name": [
        Prism3.languages.clike["class-name"],
        {
          pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
          lookbehind: true
        }
      ],
      "keyword": [
        {
          pattern: /((?:^|\})\s*)catch\b/,
          lookbehind: true
        },
        {
          pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
          lookbehind: true
        }
      ],
      // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
      "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
      "number": {
        pattern: RegExp(
          /(^|[^\w$])/.source + "(?:" + // constant
          (/NaN|Infinity/.source + "|" + // binary integer
          /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
          /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
          /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
          /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
          /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
        ),
        lookbehind: true
      },
      "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
    });
    Prism3.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
    Prism3.languages.insertBefore("javascript", "keyword", {
      "regex": {
        pattern: RegExp(
          // lookbehind
          // eslint-disable-next-line regexp/no-dupe-characters-character-class
          /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
          // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
          // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
          // with the only syntax, so we have to define 2 different regex patterns.
          /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
          /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
          /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
        ),
        lookbehind: true,
        greedy: true,
        inside: {
          "regex-source": {
            pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
            lookbehind: true,
            alias: "language-regex",
            inside: Prism3.languages.regex
          },
          "regex-delimiter": /^\/|\/$/,
          "regex-flags": /^[a-z]+$/
        }
      },
      // This must be declared before keyword because we use "function" inside the look-forward
      "function-variable": {
        pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
        alias: "function"
      },
      "parameter": [
        {
          pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
          lookbehind: true,
          inside: Prism3.languages.javascript
        },
        {
          pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
          lookbehind: true,
          inside: Prism3.languages.javascript
        },
        {
          pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
          lookbehind: true,
          inside: Prism3.languages.javascript
        },
        {
          pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
          lookbehind: true,
          inside: Prism3.languages.javascript
        }
      ],
      "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
    });
    Prism3.languages.insertBefore("javascript", "string", {
      "hashbang": {
        pattern: /^#!.*/,
        greedy: true,
        alias: "comment"
      },
      "template-string": {
        pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
        greedy: true,
        inside: {
          "template-punctuation": {
            pattern: /^`|`$/,
            alias: "string"
          },
          "interpolation": {
            pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
            lookbehind: true,
            inside: {
              "interpolation-punctuation": {
                pattern: /^\$\{|\}$/,
                alias: "punctuation"
              },
              rest: Prism3.languages.javascript
            }
          },
          "string": /[\s\S]+/
        }
      },
      "string-property": {
        pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
        lookbehind: true,
        greedy: true,
        alias: "property"
      }
    });
    Prism3.languages.insertBefore("javascript", "operator", {
      "literal-property": {
        pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
        lookbehind: true,
        alias: "property"
      }
    });
    if (Prism3.languages.markup) {
      Prism3.languages.markup.tag.addInlined("script", "javascript");
      Prism3.languages.markup.tag.addAttribute(
        /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
        "javascript"
      );
    }
    Prism3.languages.js = Prism3.languages.javascript;
    (function() {
      if (typeof Prism3 === "undefined" || typeof document === "undefined") {
        return;
      }
      if (!Element.prototype.matches) {
        Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
      }
      var LOADING_MESSAGE = "Loading\u2026";
      var FAILURE_MESSAGE = function(status, message) {
        return "\u2716 Error " + status + " while fetching file: " + message;
      };
      var FAILURE_EMPTY_MESSAGE = "\u2716 Error: File does not exist or is empty";
      var EXTENSIONS = {
        "js": "javascript",
        "py": "python",
        "rb": "ruby",
        "ps1": "powershell",
        "psm1": "powershell",
        "sh": "bash",
        "bat": "batch",
        "h": "c",
        "tex": "latex"
      };
      var STATUS_ATTR = "data-src-status";
      var STATUS_LOADING = "loading";
      var STATUS_LOADED = "loaded";
      var STATUS_FAILED = "failed";
      var SELECTOR = "pre[data-src]:not([" + STATUS_ATTR + '="' + STATUS_LOADED + '"]):not([' + STATUS_ATTR + '="' + STATUS_LOADING + '"])';
      function loadFile(src, success, error) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", src, true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4) {
            if (xhr.status < 400 && xhr.responseText) {
              success(xhr.responseText);
            } else {
              if (xhr.status >= 400) {
                error(FAILURE_MESSAGE(xhr.status, xhr.statusText));
              } else {
                error(FAILURE_EMPTY_MESSAGE);
              }
            }
          }
        };
        xhr.send(null);
      }
      function parseRange(range) {
        var m = /^\s*(\d+)\s*(?:(,)\s*(?:(\d+)\s*)?)?$/.exec(range || "");
        if (m) {
          var start = Number(m[1]);
          var comma = m[2];
          var end = m[3];
          if (!comma) {
            return [start, start];
          }
          if (!end) {
            return [start, void 0];
          }
          return [start, Number(end)];
        }
        return void 0;
      }
      Prism3.hooks.add("before-highlightall", function(env) {
        env.selector += ", " + SELECTOR;
      });
      Prism3.hooks.add("before-sanity-check", function(env) {
        var pre = (
          /** @type {HTMLPreElement} */
          env.element
        );
        if (pre.matches(SELECTOR)) {
          env.code = "";
          pre.setAttribute(STATUS_ATTR, STATUS_LOADING);
          var code = pre.appendChild(document.createElement("CODE"));
          code.textContent = LOADING_MESSAGE;
          var src = pre.getAttribute("data-src");
          var language = env.language;
          if (language === "none") {
            var extension = (/\.(\w+)$/.exec(src) || [, "none"])[1];
            language = EXTENSIONS[extension] || extension;
          }
          Prism3.util.setLanguage(code, language);
          Prism3.util.setLanguage(pre, language);
          var autoloader = Prism3.plugins.autoloader;
          if (autoloader) {
            autoloader.loadLanguages(language);
          }
          loadFile(
            src,
            function(text) {
              pre.setAttribute(STATUS_ATTR, STATUS_LOADED);
              var range = parseRange(pre.getAttribute("data-range"));
              if (range) {
                var lines = text.split(/\r\n?|\n/g);
                var start = range[0];
                var end = range[1] == null ? lines.length : range[1];
                if (start < 0) {
                  start += lines.length;
                }
                start = Math.max(0, Math.min(start - 1, lines.length));
                if (end < 0) {
                  end += lines.length;
                }
                end = Math.max(0, Math.min(end, lines.length));
                text = lines.slice(start, end).join("\n");
                if (!pre.hasAttribute("data-start")) {
                  pre.setAttribute("data-start", String(start + 1));
                }
              }
              code.textContent = text;
              Prism3.highlightElement(code);
            },
            function(error) {
              pre.setAttribute(STATUS_ATTR, STATUS_FAILED);
              code.textContent = error;
            }
          );
        }
      });
      Prism3.plugins.fileHighlight = {
        /**
         * Executes the File Highlight plugin for all matching `pre` elements under the given container.
         *
         * Note: Elements which are already loaded or currently loading will not be touched by this method.
         *
         * @param {ParentNode} [container=document]
         */
        highlight: function highlight(container) {
          var elements = (container || document).querySelectorAll(SELECTOR);
          for (var i = 0, element; element = elements[i++]; ) {
            Prism3.highlightElement(element);
          }
        }
      };
      var logged = false;
      Prism3.fileHighlight = function() {
        if (!logged) {
          console.warn("Prism.fileHighlight is deprecated. Use `Prism.plugins.fileHighlight.highlight` instead.");
          logged = true;
        }
        Prism3.plugins.fileHighlight.highlight.apply(this, arguments);
      };
    })();
  }
});

// public/js/prism-bundle.js
var import_prismjs = __toESM(require_prism(), 1);

// node_modules/prismjs/components/prism-javascript.js
Prism.languages.javascript = Prism.languages.extend("clike", {
  "class-name": [
    Prism.languages.clike["class-name"],
    {
      pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
      lookbehind: true
    }
  ],
  "keyword": [
    {
      pattern: /((?:^|\})\s*)catch\b/,
      lookbehind: true
    },
    {
      pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
      lookbehind: true
    }
  ],
  // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
  "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
  "number": {
    pattern: RegExp(
      /(^|[^\w$])/.source + "(?:" + // constant
      (/NaN|Infinity/.source + "|" + // binary integer
      /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
      /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
      /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
      /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
      /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
    ),
    lookbehind: true
  },
  "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
});
Prism.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
Prism.languages.insertBefore("javascript", "keyword", {
  "regex": {
    pattern: RegExp(
      // lookbehind
      // eslint-disable-next-line regexp/no-dupe-characters-character-class
      /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
      // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
      // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
      // with the only syntax, so we have to define 2 different regex patterns.
      /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
      /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
      /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
    ),
    lookbehind: true,
    greedy: true,
    inside: {
      "regex-source": {
        pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
        lookbehind: true,
        alias: "language-regex",
        inside: Prism.languages.regex
      },
      "regex-delimiter": /^\/|\/$/,
      "regex-flags": /^[a-z]+$/
    }
  },
  // This must be declared before keyword because we use "function" inside the look-forward
  "function-variable": {
    pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
    alias: "function"
  },
  "parameter": [
    {
      pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
      lookbehind: true,
      inside: Prism.languages.javascript
    }
  ],
  "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
});
Prism.languages.insertBefore("javascript", "string", {
  "hashbang": {
    pattern: /^#!.*/,
    greedy: true,
    alias: "comment"
  },
  "template-string": {
    pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
    greedy: true,
    inside: {
      "template-punctuation": {
        pattern: /^`|`$/,
        alias: "string"
      },
      "interpolation": {
        pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
        lookbehind: true,
        inside: {
          "interpolation-punctuation": {
            pattern: /^\$\{|\}$/,
            alias: "punctuation"
          },
          rest: Prism.languages.javascript
        }
      },
      "string": /[\s\S]+/
    }
  },
  "string-property": {
    pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
    lookbehind: true,
    greedy: true,
    alias: "property"
  }
});
Prism.languages.insertBefore("javascript", "operator", {
  "literal-property": {
    pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
    lookbehind: true,
    alias: "property"
  }
});
if (Prism.languages.markup) {
  Prism.languages.markup.tag.addInlined("script", "javascript");
  Prism.languages.markup.tag.addAttribute(
    /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
    "javascript"
  );
}
Prism.languages.js = Prism.languages.javascript;

// node_modules/prismjs/components/prism-typescript.js
(function(Prism3) {
  Prism3.languages.typescript = Prism3.languages.extend("javascript", {
    "class-name": {
      pattern: /(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)(?!keyof\b)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?:\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?/,
      lookbehind: true,
      greedy: true,
      inside: null
      // see below
    },
    "builtin": /\b(?:Array|Function|Promise|any|boolean|console|never|number|string|symbol|unknown)\b/
  });
  Prism3.languages.typescript.keyword.push(
    /\b(?:abstract|declare|is|keyof|readonly|require)\b/,
    // keywords that have to be followed by an identifier
    /\b(?:asserts|infer|interface|module|namespace|type)\b(?=\s*(?:[{_$a-zA-Z\xA0-\uFFFF]|$))/,
    // This is for `import type *, {}`
    /\btype\b(?=\s*(?:[\{*]|$))/
  );
  delete Prism3.languages.typescript["parameter"];
  delete Prism3.languages.typescript["literal-property"];
  var typeInside = Prism3.languages.extend("typescript", {});
  delete typeInside["class-name"];
  Prism3.languages.typescript["class-name"].inside = typeInside;
  Prism3.languages.insertBefore("typescript", "function", {
    "decorator": {
      pattern: /@[$\w\xA0-\uFFFF]+/,
      inside: {
        "at": {
          pattern: /^@/,
          alias: "operator"
        },
        "function": /^[\s\S]+/
      }
    },
    "generic-function": {
      // e.g. foo<T extends "bar" | "baz">( ...
      pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>(?=\s*\()/,
      greedy: true,
      inside: {
        "function": /^#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/,
        "generic": {
          pattern: /<[\s\S]+/,
          // everything after the first <
          alias: "class-name",
          inside: typeInside
        }
      }
    }
  });
  Prism3.languages.ts = Prism3.languages.typescript;
})(Prism);

// node_modules/prismjs/components/prism-python.js
Prism.languages.python = {
  "comment": {
    pattern: /(^|[^\\])#.*/,
    lookbehind: true,
    greedy: true
  },
  "string-interpolation": {
    pattern: /(?:f|fr|rf)(?:("""|''')[\s\S]*?\1|("|')(?:\\.|(?!\2)[^\\\r\n])*\2)/i,
    greedy: true,
    inside: {
      "interpolation": {
        // "{" <expression> <optional "!s", "!r", or "!a"> <optional ":" format specifier> "}"
        pattern: /((?:^|[^{])(?:\{\{)*)\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}])+\})+\})+\}/,
        lookbehind: true,
        inside: {
          "format-spec": {
            pattern: /(:)[^:(){}]+(?=\}$)/,
            lookbehind: true
          },
          "conversion-option": {
            pattern: /![sra](?=[:}]$)/,
            alias: "punctuation"
          },
          rest: null
        }
      },
      "string": /[\s\S]+/
    }
  },
  "triple-quoted-string": {
    pattern: /(?:[rub]|br|rb)?("""|''')[\s\S]*?\1/i,
    greedy: true,
    alias: "string"
  },
  "string": {
    pattern: /(?:[rub]|br|rb)?("|')(?:\\.|(?!\1)[^\\\r\n])*\1/i,
    greedy: true
  },
  "function": {
    pattern: /((?:^|\s)def[ \t]+)[a-zA-Z_]\w*(?=\s*\()/g,
    lookbehind: true
  },
  "class-name": {
    pattern: /(\bclass\s+)\w+/i,
    lookbehind: true
  },
  "decorator": {
    pattern: /(^[\t ]*)@\w+(?:\.\w+)*/m,
    lookbehind: true,
    alias: ["annotation", "punctuation"],
    inside: {
      "punctuation": /\./
    }
  },
  "keyword": /\b(?:_(?=\s*:)|and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|match|nonlocal|not|or|pass|print|raise|return|try|while|with|yield)\b/,
  "builtin": /\b(?:__import__|abs|all|any|apply|ascii|basestring|bin|bool|buffer|bytearray|bytes|callable|chr|classmethod|cmp|coerce|compile|complex|delattr|dict|dir|divmod|enumerate|eval|execfile|file|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|intern|isinstance|issubclass|iter|len|list|locals|long|map|max|memoryview|min|next|object|oct|open|ord|pow|property|range|raw_input|reduce|reload|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unichr|unicode|vars|xrange|zip)\b/,
  "boolean": /\b(?:False|None|True)\b/,
  "number": /\b0(?:b(?:_?[01])+|o(?:_?[0-7])+|x(?:_?[a-f0-9])+)\b|(?:\b\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\B\.\d+(?:_\d+)*)(?:e[+-]?\d+(?:_\d+)*)?j?(?!\w)/i,
  "operator": /[-+%=]=?|!=|:=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
  "punctuation": /[{}[\];(),.:]/
};
Prism.languages.python["string-interpolation"].inside["interpolation"].inside.rest = Prism.languages.python;
Prism.languages.py = Prism.languages.python;

// node_modules/prismjs/components/prism-bash.js
(function(Prism3) {
  var envVars = "\\b(?:BASH|BASHOPTS|BASH_ALIASES|BASH_ARGC|BASH_ARGV|BASH_CMDS|BASH_COMPLETION_COMPAT_DIR|BASH_LINENO|BASH_REMATCH|BASH_SOURCE|BASH_VERSINFO|BASH_VERSION|COLORTERM|COLUMNS|COMP_WORDBREAKS|DBUS_SESSION_BUS_ADDRESS|DEFAULTS_PATH|DESKTOP_SESSION|DIRSTACK|DISPLAY|EUID|GDMSESSION|GDM_LANG|GNOME_KEYRING_CONTROL|GNOME_KEYRING_PID|GPG_AGENT_INFO|GROUPS|HISTCONTROL|HISTFILE|HISTFILESIZE|HISTSIZE|HOME|HOSTNAME|HOSTTYPE|IFS|INSTANCE|JOB|LANG|LANGUAGE|LC_ADDRESS|LC_ALL|LC_IDENTIFICATION|LC_MEASUREMENT|LC_MONETARY|LC_NAME|LC_NUMERIC|LC_PAPER|LC_TELEPHONE|LC_TIME|LESSCLOSE|LESSOPEN|LINES|LOGNAME|LS_COLORS|MACHTYPE|MAILCHECK|MANDATORY_PATH|NO_AT_BRIDGE|OLDPWD|OPTERR|OPTIND|ORBIT_SOCKETDIR|OSTYPE|PAPERSIZE|PATH|PIPESTATUS|PPID|PS1|PS2|PS3|PS4|PWD|RANDOM|REPLY|SECONDS|SELINUX_INIT|SESSION|SESSIONTYPE|SESSION_MANAGER|SHELL|SHELLOPTS|SHLVL|SSH_AUTH_SOCK|TERM|UID|UPSTART_EVENTS|UPSTART_INSTANCE|UPSTART_JOB|UPSTART_SESSION|USER|WINDOWID|XAUTHORITY|XDG_CONFIG_DIRS|XDG_CURRENT_DESKTOP|XDG_DATA_DIRS|XDG_GREETER_DATA_DIR|XDG_MENU_PREFIX|XDG_RUNTIME_DIR|XDG_SEAT|XDG_SEAT_PATH|XDG_SESSION_DESKTOP|XDG_SESSION_ID|XDG_SESSION_PATH|XDG_SESSION_TYPE|XDG_VTNR|XMODIFIERS)\\b";
  var commandAfterHeredoc = {
    pattern: /(^(["']?)\w+\2)[ \t]+\S.*/,
    lookbehind: true,
    alias: "punctuation",
    // this looks reasonably well in all themes
    inside: null
    // see below
  };
  var insideString = {
    "bash": commandAfterHeredoc,
    "environment": {
      pattern: RegExp("\\$" + envVars),
      alias: "constant"
    },
    "variable": [
      // [0]: Arithmetic Environment
      {
        pattern: /\$?\(\([\s\S]+?\)\)/,
        greedy: true,
        inside: {
          // If there is a $ sign at the beginning highlight $(( and )) as variable
          "variable": [
            {
              pattern: /(^\$\(\([\s\S]+)\)\)/,
              lookbehind: true
            },
            /^\$\(\(/
          ],
          "number": /\b0x[\dA-Fa-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[Ee]-?\d+)?/,
          // Operators according to https://www.gnu.org/software/bash/manual/bashref.html#Shell-Arithmetic
          "operator": /--|\+\+|\*\*=?|<<=?|>>=?|&&|\|\||[=!+\-*/%<>^&|]=?|[?~:]/,
          // If there is no $ sign at the beginning highlight (( and )) as punctuation
          "punctuation": /\(\(?|\)\)?|,|;/
        }
      },
      // [1]: Command Substitution
      {
        pattern: /\$\((?:\([^)]+\)|[^()])+\)|`[^`]+`/,
        greedy: true,
        inside: {
          "variable": /^\$\(|^`|\)$|`$/
        }
      },
      // [2]: Brace expansion
      {
        pattern: /\$\{[^}]+\}/,
        greedy: true,
        inside: {
          "operator": /:[-=?+]?|[!\/]|##?|%%?|\^\^?|,,?/,
          "punctuation": /[\[\]]/,
          "environment": {
            pattern: RegExp("(\\{)" + envVars),
            lookbehind: true,
            alias: "constant"
          }
        }
      },
      /\$(?:\w+|[#?*!@$])/
    ],
    // Escape sequences from echo and printf's manuals, and escaped quotes.
    "entity": /\\(?:[abceEfnrtv\\"]|O?[0-7]{1,3}|U[0-9a-fA-F]{8}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{1,2})/
  };
  Prism3.languages.bash = {
    "shebang": {
      pattern: /^#!\s*\/.*/,
      alias: "important"
    },
    "comment": {
      pattern: /(^|[^"{\\$])#.*/,
      lookbehind: true
    },
    "function-name": [
      // a) function foo {
      // b) foo() {
      // c) function foo() {
      // but not “foo {”
      {
        // a) and c)
        pattern: /(\bfunction\s+)[\w-]+(?=(?:\s*\(?:\s*\))?\s*\{)/,
        lookbehind: true,
        alias: "function"
      },
      {
        // b)
        pattern: /\b[\w-]+(?=\s*\(\s*\)\s*\{)/,
        alias: "function"
      }
    ],
    // Highlight variable names as variables in for and select beginnings.
    "for-or-select": {
      pattern: /(\b(?:for|select)\s+)\w+(?=\s+in\s)/,
      alias: "variable",
      lookbehind: true
    },
    // Highlight variable names as variables in the left-hand part
    // of assignments (“=” and “+=”).
    "assign-left": {
      pattern: /(^|[\s;|&]|[<>]\()\w+(?:\.\w+)*(?=\+?=)/,
      inside: {
        "environment": {
          pattern: RegExp("(^|[\\s;|&]|[<>]\\()" + envVars),
          lookbehind: true,
          alias: "constant"
        }
      },
      alias: "variable",
      lookbehind: true
    },
    // Highlight parameter names as variables
    "parameter": {
      pattern: /(^|\s)-{1,2}(?:\w+:[+-]?)?\w+(?:\.\w+)*(?=[=\s]|$)/,
      alias: "variable",
      lookbehind: true
    },
    "string": [
      // Support for Here-documents https://en.wikipedia.org/wiki/Here_document
      {
        pattern: /((?:^|[^<])<<-?\s*)(\w+)\s[\s\S]*?(?:\r?\n|\r)\2/,
        lookbehind: true,
        greedy: true,
        inside: insideString
      },
      // Here-document with quotes around the tag
      // → No expansion (so no “inside”).
      {
        pattern: /((?:^|[^<])<<-?\s*)(["'])(\w+)\2\s[\s\S]*?(?:\r?\n|\r)\3/,
        lookbehind: true,
        greedy: true,
        inside: {
          "bash": commandAfterHeredoc
        }
      },
      // “Normal” string
      {
        // https://www.gnu.org/software/bash/manual/html_node/Double-Quotes.html
        pattern: /(^|[^\\](?:\\\\)*)"(?:\\[\s\S]|\$\([^)]+\)|\$(?!\()|`[^`]+`|[^"\\`$])*"/,
        lookbehind: true,
        greedy: true,
        inside: insideString
      },
      {
        // https://www.gnu.org/software/bash/manual/html_node/Single-Quotes.html
        pattern: /(^|[^$\\])'[^']*'/,
        lookbehind: true,
        greedy: true
      },
      {
        // https://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html
        pattern: /\$'(?:[^'\\]|\\[\s\S])*'/,
        greedy: true,
        inside: {
          "entity": insideString.entity
        }
      }
    ],
    "environment": {
      pattern: RegExp("\\$?" + envVars),
      alias: "constant"
    },
    "variable": insideString.variable,
    "function": {
      pattern: /(^|[\s;|&]|[<>]\()(?:add|apropos|apt|apt-cache|apt-get|aptitude|aspell|automysqlbackup|awk|basename|bash|bc|bconsole|bg|bzip2|cal|cargo|cat|cfdisk|chgrp|chkconfig|chmod|chown|chroot|cksum|clear|cmp|column|comm|composer|cp|cron|crontab|csplit|curl|cut|date|dc|dd|ddrescue|debootstrap|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|docker|docker-compose|du|egrep|eject|env|ethtool|expand|expect|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|git|gparted|grep|groupadd|groupdel|groupmod|groups|grub-mkconfig|gzip|halt|head|hg|history|host|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|ip|java|jobs|join|kill|killall|less|link|ln|locate|logname|logrotate|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|lynx|make|man|mc|mdadm|mkconfig|mkdir|mke2fs|mkfifo|mkfs|mkisofs|mknod|mkswap|mmv|more|most|mount|mtools|mtr|mutt|mv|nano|nc|netstat|nice|nl|node|nohup|notify-send|npm|nslookup|op|open|parted|passwd|paste|pathchk|ping|pkill|pnpm|podman|podman-compose|popd|pr|printcap|printenv|ps|pushd|pv|quota|quotacheck|quotactl|ram|rar|rcp|reboot|remsync|rename|renice|rev|rm|rmdir|rpm|rsync|scp|screen|sdiff|sed|sendmail|seq|service|sftp|sh|shellcheck|shuf|shutdown|sleep|slocate|sort|split|ssh|stat|strace|su|sudo|sum|suspend|swapon|sync|sysctl|tac|tail|tar|tee|time|timeout|top|touch|tr|traceroute|tsort|tty|umount|uname|unexpand|uniq|units|unrar|unshar|unzip|update-grub|uptime|useradd|userdel|usermod|users|uudecode|uuencode|v|vcpkg|vdir|vi|vim|virsh|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yarn|yes|zenity|zip|zsh|zypper)(?=$|[)\s;|&])/,
      lookbehind: true
    },
    "keyword": {
      pattern: /(^|[\s;|&]|[<>]\()(?:case|do|done|elif|else|esac|fi|for|function|if|in|select|then|until|while)(?=$|[)\s;|&])/,
      lookbehind: true
    },
    // https://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
    "builtin": {
      pattern: /(^|[\s;|&]|[<>]\()(?:\.|:|alias|bind|break|builtin|caller|cd|command|continue|declare|echo|enable|eval|exec|exit|export|getopts|hash|help|let|local|logout|mapfile|printf|pwd|read|readarray|readonly|return|set|shift|shopt|source|test|times|trap|type|typeset|ulimit|umask|unalias|unset)(?=$|[)\s;|&])/,
      lookbehind: true,
      // Alias added to make those easier to distinguish from strings.
      alias: "class-name"
    },
    "boolean": {
      pattern: /(^|[\s;|&]|[<>]\()(?:false|true)(?=$|[)\s;|&])/,
      lookbehind: true
    },
    "file-descriptor": {
      pattern: /\B&\d\b/,
      alias: "important"
    },
    "operator": {
      // Lots of redirections here, but not just that.
      pattern: /\d?<>|>\||\+=|=[=~]?|!=?|<<[<-]?|[&\d]?>>|\d[<>]&?|[<>][&=]?|&[>&]?|\|[&|]?/,
      inside: {
        "file-descriptor": {
          pattern: /^\d/,
          alias: "important"
        }
      }
    },
    "punctuation": /\$?\(\(?|\)\)?|\.\.|[{}[\];\\]/,
    "number": {
      pattern: /(^|\s)(?:[1-9]\d*|0)(?:[.,]\d+)?\b/,
      lookbehind: true
    }
  };
  commandAfterHeredoc.inside = Prism3.languages.bash;
  var toBeCopied = [
    "comment",
    "function-name",
    "for-or-select",
    "assign-left",
    "parameter",
    "string",
    "environment",
    "function",
    "keyword",
    "builtin",
    "boolean",
    "file-descriptor",
    "operator",
    "punctuation",
    "number"
  ];
  var inside = insideString.variable[1].inside;
  for (var i = 0; i < toBeCopied.length; i++) {
    inside[toBeCopied[i]] = Prism3.languages.bash[toBeCopied[i]];
  }
  Prism3.languages.sh = Prism3.languages.bash;
  Prism3.languages.shell = Prism3.languages.bash;
})(Prism);

// node_modules/prismjs/components/prism-markup.js
Prism.languages.markup = {
  "comment": {
    pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
    greedy: true
  },
  "prolog": {
    pattern: /<\?[\s\S]+?\?>/,
    greedy: true
  },
  "doctype": {
    // https://www.w3.org/TR/xml/#NT-doctypedecl
    pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
    greedy: true,
    inside: {
      "internal-subset": {
        pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
        lookbehind: true,
        greedy: true,
        inside: null
        // see below
      },
      "string": {
        pattern: /"[^"]*"|'[^']*'/,
        greedy: true
      },
      "punctuation": /^<!|>$|[[\]]/,
      "doctype-tag": /^DOCTYPE/i,
      "name": /[^\s<>'"]+/
    }
  },
  "cdata": {
    pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
    greedy: true
  },
  "tag": {
    pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
    greedy: true,
    inside: {
      "tag": {
        pattern: /^<\/?[^\s>\/]+/,
        inside: {
          "punctuation": /^<\/?/,
          "namespace": /^[^\s>\/:]+:/
        }
      },
      "special-attr": [],
      "attr-value": {
        pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
        inside: {
          "punctuation": [
            {
              pattern: /^=/,
              alias: "attr-equals"
            },
            {
              pattern: /^(\s*)["']|["']$/,
              lookbehind: true
            }
          ]
        }
      },
      "punctuation": /\/?>/,
      "attr-name": {
        pattern: /[^\s>\/]+/,
        inside: {
          "namespace": /^[^\s>\/:]+:/
        }
      }
    }
  },
  "entity": [
    {
      pattern: /&[\da-z]{1,8};/i,
      alias: "named-entity"
    },
    /&#x?[\da-f]{1,8};/i
  ]
};
Prism.languages.markup["tag"].inside["attr-value"].inside["entity"] = Prism.languages.markup["entity"];
Prism.languages.markup["doctype"].inside["internal-subset"].inside = Prism.languages.markup;
Prism.hooks.add("wrap", function(env) {
  if (env.type === "entity") {
    env.attributes["title"] = env.content.replace(/&amp;/, "&");
  }
});
Object.defineProperty(Prism.languages.markup.tag, "addInlined", {
  /**
   * Adds an inlined language to markup.
   *
   * An example of an inlined language is CSS with `<style>` tags.
   *
   * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
   * case insensitive.
   * @param {string} lang The language key.
   * @example
   * addInlined('style', 'css');
   */
  value: function addInlined(tagName, lang) {
    var includedCdataInside = {};
    includedCdataInside["language-" + lang] = {
      pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
      lookbehind: true,
      inside: Prism.languages[lang]
    };
    includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;
    var inside = {
      "included-cdata": {
        pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
        inside: includedCdataInside
      }
    };
    inside["language-" + lang] = {
      pattern: /[\s\S]+/,
      inside: Prism.languages[lang]
    };
    var def = {};
    def[tagName] = {
      pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
        return tagName;
      }), "i"),
      lookbehind: true,
      greedy: true,
      inside
    };
    Prism.languages.insertBefore("markup", "cdata", def);
  }
});
Object.defineProperty(Prism.languages.markup.tag, "addAttribute", {
  /**
   * Adds an pattern to highlight languages embedded in HTML attributes.
   *
   * An example of an inlined language is CSS with `style` attributes.
   *
   * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
   * case insensitive.
   * @param {string} lang The language key.
   * @example
   * addAttribute('style', 'css');
   */
  value: function(attrName, lang) {
    Prism.languages.markup.tag.inside["special-attr"].push({
      pattern: RegExp(
        /(^|["'\s])/.source + "(?:" + attrName + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
        "i"
      ),
      lookbehind: true,
      inside: {
        "attr-name": /^[^\s=]+/,
        "attr-value": {
          pattern: /=[\s\S]+/,
          inside: {
            "value": {
              pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
              lookbehind: true,
              alias: [lang, "language-" + lang],
              inside: Prism.languages[lang]
            },
            "punctuation": [
              {
                pattern: /^=/,
                alias: "attr-equals"
              },
              /"|'/
            ]
          }
        }
      }
    });
  }
});
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;
Prism.languages.xml = Prism.languages.extend("markup", {});
Prism.languages.ssml = Prism.languages.xml;
Prism.languages.atom = Prism.languages.xml;
Prism.languages.rss = Prism.languages.xml;

// node_modules/prismjs/components/prism-css.js
(function(Prism3) {
  var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
  Prism3.languages.css = {
    "comment": /\/\*[\s\S]*?\*\//,
    "atrule": {
      pattern: RegExp("@[\\w-](?:" + /[^;{\s"']|\s+(?!\s)/.source + "|" + string.source + ")*?" + /(?:;|(?=\s*\{))/.source),
      inside: {
        "rule": /^@[\w-]+/,
        "selector-function-argument": {
          pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
          lookbehind: true,
          alias: "selector"
        },
        "keyword": {
          pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
          lookbehind: true
        }
        // See rest below
      }
    },
    "url": {
      // https://drafts.csswg.org/css-values-3/#urls
      pattern: RegExp("\\burl\\((?:" + string.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)", "i"),
      greedy: true,
      inside: {
        "function": /^url/i,
        "punctuation": /^\(|\)$/,
        "string": {
          pattern: RegExp("^" + string.source + "$"),
          alias: "url"
        }
      }
    },
    "selector": {
      pattern: RegExp(`(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + string.source + ")*(?=\\s*\\{)"),
      lookbehind: true
    },
    "string": {
      pattern: string,
      greedy: true
    },
    "property": {
      pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
      lookbehind: true
    },
    "important": /!important\b/i,
    "function": {
      pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
      lookbehind: true
    },
    "punctuation": /[(){};:,]/
  };
  Prism3.languages.css["atrule"].inside.rest = Prism3.languages.css;
  var markup = Prism3.languages.markup;
  if (markup) {
    markup.tag.addInlined("style", "css");
    markup.tag.addAttribute("style", "css");
  }
})(Prism);

// node_modules/prismjs/components/prism-json.js
Prism.languages.json = {
  "property": {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
    lookbehind: true,
    greedy: true
  },
  "string": {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
    lookbehind: true,
    greedy: true
  },
  "comment": {
    pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
    greedy: true
  },
  "number": /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
  "punctuation": /[{}[\],]/,
  "operator": /:/,
  "boolean": /\b(?:false|true)\b/,
  "null": {
    pattern: /\bnull\b/,
    alias: "keyword"
  }
};
Prism.languages.webmanifest = Prism.languages.json;

// node_modules/prismjs/components/prism-java.js
(function(Prism3) {
  var keywords = /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|exports|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|module|native|new|non-sealed|null|open|opens|package|permits|private|protected|provides|public|record(?!\s*[(){}[\]<>=%~.:,;?+\-*/&|^])|requires|return|sealed|short|static|strictfp|super|switch|synchronized|this|throw|throws|to|transient|transitive|try|uses|var|void|volatile|while|with|yield)\b/;
  var classNamePrefix = /(?:[a-z]\w*\s*\.\s*)*(?:[A-Z]\w*\s*\.\s*)*/.source;
  var className = {
    pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z](?:[\d_A-Z]*[a-z]\w*)?\b/.source),
    lookbehind: true,
    inside: {
      "namespace": {
        pattern: /^[a-z]\w*(?:\s*\.\s*[a-z]\w*)*(?:\s*\.)?/,
        inside: {
          "punctuation": /\./
        }
      },
      "punctuation": /\./
    }
  };
  Prism3.languages.java = Prism3.languages.extend("clike", {
    "string": {
      pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"/,
      lookbehind: true,
      greedy: true
    },
    "class-name": [
      className,
      {
        // variables, parameters, and constructor references
        // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
        pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z]\w*(?=\s+\w+\s*[;,=()]|\s*(?:\[[\s,]*\]\s*)?::\s*new\b)/.source),
        lookbehind: true,
        inside: className.inside
      },
      {
        // class names based on keyword
        // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
        pattern: RegExp(/(\b(?:class|enum|extends|implements|instanceof|interface|new|record|throws)\s+)/.source + classNamePrefix + /[A-Z]\w*\b/.source),
        lookbehind: true,
        inside: className.inside
      }
    ],
    "keyword": keywords,
    "function": [
      Prism3.languages.clike.function,
      {
        pattern: /(::\s*)[a-z_]\w*/,
        lookbehind: true
      }
    ],
    "number": /\b0b[01][01_]*L?\b|\b0x(?:\.[\da-f_p+-]+|[\da-f_]+(?:\.[\da-f_p+-]+)?)\b|(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?\d[\d_]*)?[dfl]?/i,
    "operator": {
      pattern: /(^|[^.])(?:<<=?|>>>?=?|->|--|\+\+|&&|\|\||::|[?:~]|[-+*/%&|^!=<>]=?)/m,
      lookbehind: true
    },
    "constant": /\b[A-Z][A-Z_\d]+\b/
  });
  Prism3.languages.insertBefore("java", "string", {
    "triple-quoted-string": {
      // http://openjdk.java.net/jeps/355#Description
      pattern: /"""[ \t]*[\r\n](?:(?:"|"")?(?:\\.|[^"\\]))*"""/,
      greedy: true,
      alias: "string"
    },
    "char": {
      pattern: /'(?:\\.|[^'\\\r\n]){1,6}'/,
      greedy: true
    }
  });
  Prism3.languages.insertBefore("java", "class-name", {
    "annotation": {
      pattern: /(^|[^.])@\w+(?:\s*\.\s*\w+)*/,
      lookbehind: true,
      alias: "punctuation"
    },
    "generics": {
      pattern: /<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&))*>)*>)*>)*>/,
      inside: {
        "class-name": className,
        "keyword": keywords,
        "punctuation": /[<>(),.:]/,
        "operator": /[?&|]/
      }
    },
    "import": [
      {
        pattern: RegExp(/(\bimport\s+)/.source + classNamePrefix + /(?:[A-Z]\w*|\*)(?=\s*;)/.source),
        lookbehind: true,
        inside: {
          "namespace": className.inside.namespace,
          "punctuation": /\./,
          "operator": /\*/,
          "class-name": /\w+/
        }
      },
      {
        pattern: RegExp(/(\bimport\s+static\s+)/.source + classNamePrefix + /(?:\w+|\*)(?=\s*;)/.source),
        lookbehind: true,
        alias: "static",
        inside: {
          "namespace": className.inside.namespace,
          "static": /\b\w+$/,
          "punctuation": /\./,
          "operator": /\*/,
          "class-name": /\w+/
        }
      }
    ],
    "namespace": {
      pattern: RegExp(
        /(\b(?:exports|import(?:\s+static)?|module|open|opens|package|provides|requires|to|transitive|uses|with)\s+)(?!<keyword>)[a-z]\w*(?:\.[a-z]\w*)*\.?/.source.replace(/<keyword>/g, function() {
          return keywords.source;
        })
      ),
      lookbehind: true,
      inside: {
        "punctuation": /\./
      }
    }
  });
})(Prism);

// node_modules/prismjs/components/prism-c.js
Prism.languages.c = Prism.languages.extend("clike", {
  "comment": {
    pattern: /\/\/(?:[^\r\n\\]|\\(?:\r\n?|\n|(?![\r\n])))*|\/\*[\s\S]*?(?:\*\/|$)/,
    greedy: true
  },
  "string": {
    // https://en.cppreference.com/w/c/language/string_literal
    pattern: /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
    greedy: true
  },
  "class-name": {
    pattern: /(\b(?:enum|struct)\s+(?:__attribute__\s*\(\([\s\S]*?\)\)\s*)?)\w+|\b[a-z]\w*_t\b/,
    lookbehind: true
  },
  "keyword": /\b(?:_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local|__attribute__|asm|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|typeof|union|unsigned|void|volatile|while)\b/,
  "function": /\b[a-z_]\w*(?=\s*\()/i,
  "number": /(?:\b0x(?:[\da-f]+(?:\.[\da-f]*)?|\.[\da-f]+)(?:p[+-]?\d+)?|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?)[ful]{0,4}/i,
  "operator": />>=?|<<=?|->|([-+&|:])\1|[?:~]|[-+*/%&|^!=<>]=?/
});
Prism.languages.insertBefore("c", "string", {
  "char": {
    // https://en.cppreference.com/w/c/language/character_constant
    pattern: /'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n]){0,32}'/,
    greedy: true
  }
});
Prism.languages.insertBefore("c", "string", {
  "macro": {
    // allow for multiline macro definitions
    // spaces after the # character compile fine with gcc
    pattern: /(^[\t ]*)#\s*[a-z](?:[^\r\n\\/]|\/(?!\*)|\/\*(?:[^*]|\*(?!\/))*\*\/|\\(?:\r\n|[\s\S]))*/im,
    lookbehind: true,
    greedy: true,
    alias: "property",
    inside: {
      "string": [
        {
          // highlight the path of the include statement as a string
          pattern: /^(#\s*include\s*)<[^>]+>/,
          lookbehind: true
        },
        Prism.languages.c["string"]
      ],
      "char": Prism.languages.c["char"],
      "comment": Prism.languages.c["comment"],
      "macro-name": [
        {
          pattern: /(^#\s*define\s+)\w+\b(?!\()/i,
          lookbehind: true
        },
        {
          pattern: /(^#\s*define\s+)\w+\b(?=\()/i,
          lookbehind: true,
          alias: "function"
        }
      ],
      // highlight macro directives as keywords
      "directive": {
        pattern: /^(#\s*)[a-z]+/,
        lookbehind: true,
        alias: "keyword"
      },
      "directive-hash": /^#/,
      "punctuation": /##|\\(?=[\r\n])/,
      "expression": {
        pattern: /\S[\s\S]*/,
        inside: Prism.languages.c
      }
    }
  }
});
Prism.languages.insertBefore("c", "function", {
  // highlight predefined macros as constants
  "constant": /\b(?:EOF|NULL|SEEK_CUR|SEEK_END|SEEK_SET|__DATE__|__FILE__|__LINE__|__TIMESTAMP__|__TIME__|__func__|stderr|stdin|stdout)\b/
});
delete Prism.languages.c["boolean"];

// node_modules/prismjs/components/prism-cpp.js
(function(Prism3) {
  var keyword = /\b(?:alignas|alignof|asm|auto|bool|break|case|catch|char|char16_t|char32_t|char8_t|class|co_await|co_return|co_yield|compl|concept|const|const_cast|consteval|constexpr|constinit|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|final|float|for|friend|goto|if|import|inline|int|int16_t|int32_t|int64_t|int8_t|long|module|mutable|namespace|new|noexcept|nullptr|operator|override|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|try|typedef|typeid|typename|uint16_t|uint32_t|uint64_t|uint8_t|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/;
  var modName = /\b(?!<keyword>)\w+(?:\s*\.\s*\w+)*\b/.source.replace(/<keyword>/g, function() {
    return keyword.source;
  });
  Prism3.languages.cpp = Prism3.languages.extend("c", {
    "class-name": [
      {
        pattern: RegExp(/(\b(?:class|concept|enum|struct|typename)\s+)(?!<keyword>)\w+/.source.replace(/<keyword>/g, function() {
          return keyword.source;
        })),
        lookbehind: true
      },
      // This is intended to capture the class name of method implementations like:
      //   void foo::bar() const {}
      // However! The `foo` in the above example could also be a namespace, so we only capture the class name if
      // it starts with an uppercase letter. This approximation should give decent results.
      /\b[A-Z]\w*(?=\s*::\s*\w+\s*\()/,
      // This will capture the class name before destructors like:
      //   Foo::~Foo() {}
      /\b[A-Z_]\w*(?=\s*::\s*~\w+\s*\()/i,
      // This also intends to capture the class name of method implementations but here the class has template
      // parameters, so it can't be a namespace (until C++ adds generic namespaces).
      /\b\w+(?=\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>\s*::\s*\w+\s*\()/
    ],
    "keyword": keyword,
    "number": {
      pattern: /(?:\b0b[01']+|\b0x(?:[\da-f']+(?:\.[\da-f']*)?|\.[\da-f']+)(?:p[+-]?[\d']+)?|(?:\b[\d']+(?:\.[\d']*)?|\B\.[\d']+)(?:e[+-]?[\d']+)?)[ful]{0,4}/i,
      greedy: true
    },
    "operator": />>=?|<<=?|->|--|\+\+|&&|\|\||[?:~]|<=>|[-+*/%&|^!=<>]=?|\b(?:and|and_eq|bitand|bitor|not|not_eq|or|or_eq|xor|xor_eq)\b/,
    "boolean": /\b(?:false|true)\b/
  });
  Prism3.languages.insertBefore("cpp", "string", {
    "module": {
      // https://en.cppreference.com/w/cpp/language/modules
      pattern: RegExp(
        /(\b(?:import|module)\s+)/.source + "(?:" + // header-name
        /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|<[^<>\r\n]*>/.source + "|" + // module name or partition or both
        /<mod-name>(?:\s*:\s*<mod-name>)?|:\s*<mod-name>/.source.replace(/<mod-name>/g, function() {
          return modName;
        }) + ")"
      ),
      lookbehind: true,
      greedy: true,
      inside: {
        "string": /^[<"][\s\S]+/,
        "operator": /:/,
        "punctuation": /\./
      }
    },
    "raw-string": {
      pattern: /R"([^()\\ ]{0,16})\([\s\S]*?\)\1"/,
      alias: "string",
      greedy: true
    }
  });
  Prism3.languages.insertBefore("cpp", "keyword", {
    "generic-function": {
      pattern: /\b(?!operator\b)[a-z_]\w*\s*<(?:[^<>]|<[^<>]*>)*>(?=\s*\()/i,
      inside: {
        "function": /^\w+/,
        "generic": {
          pattern: /<[\s\S]+/,
          alias: "class-name",
          inside: Prism3.languages.cpp
        }
      }
    }
  });
  Prism3.languages.insertBefore("cpp", "operator", {
    "double-colon": {
      pattern: /::/,
      alias: "punctuation"
    }
  });
  Prism3.languages.insertBefore("cpp", "class-name", {
    // the base clause is an optional list of parent classes
    // https://en.cppreference.com/w/cpp/language/class
    "base-clause": {
      pattern: /(\b(?:class|struct)\s+\w+\s*:\s*)[^;{}"'\s]+(?:\s+[^;{}"'\s]+)*(?=\s*[;{])/,
      lookbehind: true,
      greedy: true,
      inside: Prism3.languages.extend("cpp", {})
    }
  });
  Prism3.languages.insertBefore("inside", "double-colon", {
    // All untokenized words that are not namespaces should be class names
    "class-name": /\b[a-z_]\w*\b(?!\s*::)/i
  }, Prism3.languages.cpp["base-clause"]);
})(Prism);

// node_modules/prismjs/components/prism-rust.js
(function(Prism3) {
  var multilineComment = /\/\*(?:[^*/]|\*(?!\/)|\/(?!\*)|<self>)*\*\//.source;
  for (var i = 0; i < 2; i++) {
    multilineComment = multilineComment.replace(/<self>/g, function() {
      return multilineComment;
    });
  }
  multilineComment = multilineComment.replace(/<self>/g, function() {
    return /[^\s\S]/.source;
  });
  Prism3.languages.rust = {
    "comment": [
      {
        pattern: RegExp(/(^|[^\\])/.source + multilineComment),
        lookbehind: true,
        greedy: true
      },
      {
        pattern: /(^|[^\\:])\/\/.*/,
        lookbehind: true,
        greedy: true
      }
    ],
    "string": {
      pattern: /b?"(?:\\[\s\S]|[^\\"])*"|b?r(#*)"(?:[^"]|"(?!\1))*"\1/,
      greedy: true
    },
    "char": {
      pattern: /b?'(?:\\(?:x[0-7][\da-fA-F]|u\{(?:[\da-fA-F]_*){1,6}\}|.)|[^\\\r\n\t'])'/,
      greedy: true
    },
    "attribute": {
      pattern: /#!?\[(?:[^\[\]"]|"(?:\\[\s\S]|[^\\"])*")*\]/,
      greedy: true,
      alias: "attr-name",
      inside: {
        "string": null
        // see below
      }
    },
    // Closure params should not be confused with bitwise OR |
    "closure-params": {
      pattern: /([=(,:]\s*|\bmove\s*)\|[^|]*\||\|[^|]*\|(?=\s*(?:\{|->))/,
      lookbehind: true,
      greedy: true,
      inside: {
        "closure-punctuation": {
          pattern: /^\||\|$/,
          alias: "punctuation"
        },
        rest: null
        // see below
      }
    },
    "lifetime-annotation": {
      pattern: /'\w+/,
      alias: "symbol"
    },
    "fragment-specifier": {
      pattern: /(\$\w+:)[a-z]+/,
      lookbehind: true,
      alias: "punctuation"
    },
    "variable": /\$\w+/,
    "function-definition": {
      pattern: /(\bfn\s+)\w+/,
      lookbehind: true,
      alias: "function"
    },
    "type-definition": {
      pattern: /(\b(?:enum|struct|trait|type|union)\s+)\w+/,
      lookbehind: true,
      alias: "class-name"
    },
    "module-declaration": [
      {
        pattern: /(\b(?:crate|mod)\s+)[a-z][a-z_\d]*/,
        lookbehind: true,
        alias: "namespace"
      },
      {
        pattern: /(\b(?:crate|self|super)\s*)::\s*[a-z][a-z_\d]*\b(?:\s*::(?:\s*[a-z][a-z_\d]*\s*::)*)?/,
        lookbehind: true,
        alias: "namespace",
        inside: {
          "punctuation": /::/
        }
      }
    ],
    "keyword": [
      // https://github.com/rust-lang/reference/blob/master/src/keywords.md
      /\b(?:Self|abstract|as|async|await|become|box|break|const|continue|crate|do|dyn|else|enum|extern|final|fn|for|if|impl|in|let|loop|macro|match|mod|move|mut|override|priv|pub|ref|return|self|static|struct|super|trait|try|type|typeof|union|unsafe|unsized|use|virtual|where|while|yield)\b/,
      // primitives and str
      // https://doc.rust-lang.org/stable/rust-by-example/primitives.html
      /\b(?:bool|char|f(?:32|64)|[ui](?:8|16|32|64|128|size)|str)\b/
    ],
    // functions can technically start with an upper-case letter, but this will introduce a lot of false positives
    // and Rust's naming conventions recommend snake_case anyway.
    // https://doc.rust-lang.org/1.0.0/style/style/naming/README.html
    "function": /\b[a-z_]\w*(?=\s*(?:::\s*<|\())/,
    "macro": {
      pattern: /\b\w+!/,
      alias: "property"
    },
    "constant": /\b[A-Z_][A-Z_\d]+\b/,
    "class-name": /\b[A-Z]\w*\b/,
    "namespace": {
      pattern: /(?:\b[a-z][a-z_\d]*\s*::\s*)*\b[a-z][a-z_\d]*\s*::(?!\s*<)/,
      inside: {
        "punctuation": /::/
      }
    },
    // Hex, oct, bin, dec numbers with visual separators and type suffix
    "number": /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*|(?:(?:\d(?:_?\d)*)?\.)?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)(?:_?(?:f32|f64|[iu](?:8|16|32|64|size)?))?\b/,
    "boolean": /\b(?:false|true)\b/,
    "punctuation": /->|\.\.=|\.{1,3}|::|[{}[\];(),:]/,
    "operator": /[-+*\/%!^]=?|=[=>]?|&[&=]?|\|[|=]?|<<?=?|>>?=?|[@?]/
  };
  Prism3.languages.rust["closure-params"].inside.rest = Prism3.languages.rust;
  Prism3.languages.rust["attribute"].inside["string"] = Prism3.languages.rust["string"];
})(Prism);

// node_modules/prismjs/components/prism-go.js
Prism.languages.go = Prism.languages.extend("clike", {
  "string": {
    pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"|`[^`]*`/,
    lookbehind: true,
    greedy: true
  },
  "keyword": /\b(?:break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go(?:to)?|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/,
  "boolean": /\b(?:_|false|iota|nil|true)\b/,
  "number": [
    // binary and octal integers
    /\b0(?:b[01_]+|o[0-7_]+)i?\b/i,
    // hexadecimal integers and floats
    /\b0x(?:[a-f\d_]+(?:\.[a-f\d_]*)?|\.[a-f\d_]+)(?:p[+-]?\d+(?:_\d+)*)?i?(?!\w)/i,
    // decimal integers and floats
    /(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?[\d_]+)?i?(?!\w)/i
  ],
  "operator": /[*\/%^!=]=?|\+[=+]?|-[=-]?|\|[=|]?|&(?:=|&|\^=?)?|>(?:>=?|=)?|<(?:<=?|=|-)?|:=|\.\.\./,
  "builtin": /\b(?:append|bool|byte|cap|close|complex|complex(?:64|128)|copy|delete|error|float(?:32|64)|u?int(?:8|16|32|64)?|imag|len|make|new|panic|print(?:ln)?|real|recover|rune|string|uintptr)\b/
});
Prism.languages.insertBefore("go", "string", {
  "char": {
    pattern: /'(?:\\.|[^'\\\r\n]){0,10}'/,
    greedy: true
  }
});
delete Prism.languages.go["class-name"];

// node_modules/prismjs/components/prism-php.js
(function(Prism3) {
  var comment = /\/\*[\s\S]*?\*\/|\/\/.*|#(?!\[).*/;
  var constant = [
    {
      pattern: /\b(?:false|true)\b/i,
      alias: "boolean"
    },
    {
      pattern: /(::\s*)\b[a-z_]\w*\b(?!\s*\()/i,
      greedy: true,
      lookbehind: true
    },
    {
      pattern: /(\b(?:case|const)\s+)\b[a-z_]\w*(?=\s*[;=])/i,
      greedy: true,
      lookbehind: true
    },
    /\b(?:null)\b/i,
    /\b[A-Z_][A-Z0-9_]*\b(?!\s*\()/
  ];
  var number = /\b0b[01]+(?:_[01]+)*\b|\b0o[0-7]+(?:_[0-7]+)*\b|\b0x[\da-f]+(?:_[\da-f]+)*\b|(?:\b\d+(?:_\d+)*\.?(?:\d+(?:_\d+)*)?|\B\.\d+)(?:e[+-]?\d+)?/i;
  var operator = /<?=>|\?\?=?|\.{3}|\??->|[!=]=?=?|::|\*\*=?|--|\+\+|&&|\|\||<<|>>|[?~]|[/^|%*&<>.+-]=?/;
  var punctuation = /[{}\[\](),:;]/;
  Prism3.languages.php = {
    "delimiter": {
      pattern: /\?>$|^<\?(?:php(?=\s)|=)?/i,
      alias: "important"
    },
    "comment": comment,
    "variable": /\$+(?:\w+\b|(?=\{))/,
    "package": {
      pattern: /(namespace\s+|use\s+(?:function\s+)?)(?:\\?\b[a-z_]\w*)+\b(?!\\)/i,
      lookbehind: true,
      inside: {
        "punctuation": /\\/
      }
    },
    "class-name-definition": {
      pattern: /(\b(?:class|enum|interface|trait)\s+)\b[a-z_]\w*(?!\\)\b/i,
      lookbehind: true,
      alias: "class-name"
    },
    "function-definition": {
      pattern: /(\bfunction\s+)[a-z_]\w*(?=\s*\()/i,
      lookbehind: true,
      alias: "function"
    },
    "keyword": [
      {
        pattern: /(\(\s*)\b(?:array|bool|boolean|float|int|integer|object|string)\b(?=\s*\))/i,
        alias: "type-casting",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /([(,?]\s*)\b(?:array(?!\s*\()|bool|callable|(?:false|null)(?=\s*\|)|float|int|iterable|mixed|object|self|static|string)\b(?=\s*\$)/i,
        alias: "type-hint",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /(\)\s*:\s*(?:\?\s*)?)\b(?:array(?!\s*\()|bool|callable|(?:false|null)(?=\s*\|)|float|int|iterable|mixed|never|object|self|static|string|void)\b/i,
        alias: "return-type",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /\b(?:array(?!\s*\()|bool|float|int|iterable|mixed|object|string|void)\b/i,
        alias: "type-declaration",
        greedy: true
      },
      {
        pattern: /(\|\s*)(?:false|null)\b|\b(?:false|null)(?=\s*\|)/i,
        alias: "type-declaration",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /\b(?:parent|self|static)(?=\s*::)/i,
        alias: "static-context",
        greedy: true
      },
      {
        // yield from
        pattern: /(\byield\s+)from\b/i,
        lookbehind: true
      },
      // `class` is always a keyword unlike other keywords
      /\bclass\b/i,
      {
        // https://www.php.net/manual/en/reserved.keywords.php
        //
        // keywords cannot be preceded by "->"
        // the complex lookbehind means `(?<!(?:->|::)\s*)`
        pattern: /((?:^|[^\s>:]|(?:^|[^-])>|(?:^|[^:]):)\s*)\b(?:abstract|and|array|as|break|callable|case|catch|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|enum|eval|exit|extends|final|finally|fn|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|never|new|or|parent|print|private|protected|public|readonly|require|require_once|return|self|static|switch|throw|trait|try|unset|use|var|while|xor|yield|__halt_compiler)\b/i,
        lookbehind: true
      }
    ],
    "argument-name": {
      pattern: /([(,]\s*)\b[a-z_]\w*(?=\s*:(?!:))/i,
      lookbehind: true
    },
    "class-name": [
      {
        pattern: /(\b(?:extends|implements|instanceof|new(?!\s+self|\s+static))\s+|\bcatch\s*\()\b[a-z_]\w*(?!\\)\b/i,
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /(\|\s*)\b[a-z_]\w*(?!\\)\b/i,
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /\b[a-z_]\w*(?!\\)\b(?=\s*\|)/i,
        greedy: true
      },
      {
        pattern: /(\|\s*)(?:\\?\b[a-z_]\w*)+\b/i,
        alias: "class-name-fully-qualified",
        greedy: true,
        lookbehind: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /(?:\\?\b[a-z_]\w*)+\b(?=\s*\|)/i,
        alias: "class-name-fully-qualified",
        greedy: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /(\b(?:extends|implements|instanceof|new(?!\s+self\b|\s+static\b))\s+|\bcatch\s*\()(?:\\?\b[a-z_]\w*)+\b(?!\\)/i,
        alias: "class-name-fully-qualified",
        greedy: true,
        lookbehind: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /\b[a-z_]\w*(?=\s*\$)/i,
        alias: "type-declaration",
        greedy: true
      },
      {
        pattern: /(?:\\?\b[a-z_]\w*)+(?=\s*\$)/i,
        alias: ["class-name-fully-qualified", "type-declaration"],
        greedy: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /\b[a-z_]\w*(?=\s*::)/i,
        alias: "static-context",
        greedy: true
      },
      {
        pattern: /(?:\\?\b[a-z_]\w*)+(?=\s*::)/i,
        alias: ["class-name-fully-qualified", "static-context"],
        greedy: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /([(,?]\s*)[a-z_]\w*(?=\s*\$)/i,
        alias: "type-hint",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /([(,?]\s*)(?:\\?\b[a-z_]\w*)+(?=\s*\$)/i,
        alias: ["class-name-fully-qualified", "type-hint"],
        greedy: true,
        lookbehind: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /(\)\s*:\s*(?:\?\s*)?)\b[a-z_]\w*(?!\\)\b/i,
        alias: "return-type",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /(\)\s*:\s*(?:\?\s*)?)(?:\\?\b[a-z_]\w*)+\b(?!\\)/i,
        alias: ["class-name-fully-qualified", "return-type"],
        greedy: true,
        lookbehind: true,
        inside: {
          "punctuation": /\\/
        }
      }
    ],
    "constant": constant,
    "function": {
      pattern: /(^|[^\\\w])\\?[a-z_](?:[\w\\]*\w)?(?=\s*\()/i,
      lookbehind: true,
      inside: {
        "punctuation": /\\/
      }
    },
    "property": {
      pattern: /(->\s*)\w+/,
      lookbehind: true
    },
    "number": number,
    "operator": operator,
    "punctuation": punctuation
  };
  var string_interpolation = {
    pattern: /\{\$(?:\{(?:\{[^{}]+\}|[^{}]+)\}|[^{}])+\}|(^|[^\\{])\$+(?:\w+(?:\[[^\r\n\[\]]+\]|->\w+)?)/,
    lookbehind: true,
    inside: Prism3.languages.php
  };
  var string = [
    {
      pattern: /<<<'([^']+)'[\r\n](?:.*[\r\n])*?\1;/,
      alias: "nowdoc-string",
      greedy: true,
      inside: {
        "delimiter": {
          pattern: /^<<<'[^']+'|[a-z_]\w*;$/i,
          alias: "symbol",
          inside: {
            "punctuation": /^<<<'?|[';]$/
          }
        }
      }
    },
    {
      pattern: /<<<(?:"([^"]+)"[\r\n](?:.*[\r\n])*?\1;|([a-z_]\w*)[\r\n](?:.*[\r\n])*?\2;)/i,
      alias: "heredoc-string",
      greedy: true,
      inside: {
        "delimiter": {
          pattern: /^<<<(?:"[^"]+"|[a-z_]\w*)|[a-z_]\w*;$/i,
          alias: "symbol",
          inside: {
            "punctuation": /^<<<"?|[";]$/
          }
        },
        "interpolation": string_interpolation
      }
    },
    {
      pattern: /`(?:\\[\s\S]|[^\\`])*`/,
      alias: "backtick-quoted-string",
      greedy: true
    },
    {
      pattern: /'(?:\\[\s\S]|[^\\'])*'/,
      alias: "single-quoted-string",
      greedy: true
    },
    {
      pattern: /"(?:\\[\s\S]|[^\\"])*"/,
      alias: "double-quoted-string",
      greedy: true,
      inside: {
        "interpolation": string_interpolation
      }
    }
  ];
  Prism3.languages.insertBefore("php", "variable", {
    "string": string,
    "attribute": {
      pattern: /#\[(?:[^"'\/#]|\/(?![*/])|\/\/.*$|#(?!\[).*$|\/\*(?:[^*]|\*(?!\/))*\*\/|"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*')+\](?=\s*[a-z$#])/im,
      greedy: true,
      inside: {
        "attribute-content": {
          pattern: /^(#\[)[\s\S]+(?=\]$)/,
          lookbehind: true,
          // inside can appear subset of php
          inside: {
            "comment": comment,
            "string": string,
            "attribute-class-name": [
              {
                pattern: /([^:]|^)\b[a-z_]\w*(?!\\)\b/i,
                alias: "class-name",
                greedy: true,
                lookbehind: true
              },
              {
                pattern: /([^:]|^)(?:\\?\b[a-z_]\w*)+/i,
                alias: [
                  "class-name",
                  "class-name-fully-qualified"
                ],
                greedy: true,
                lookbehind: true,
                inside: {
                  "punctuation": /\\/
                }
              }
            ],
            "constant": constant,
            "number": number,
            "operator": operator,
            "punctuation": punctuation
          }
        },
        "delimiter": {
          pattern: /^#\[|\]$/,
          alias: "punctuation"
        }
      }
    }
  });
  Prism3.hooks.add("before-tokenize", function(env) {
    if (!/<\?/.test(env.code)) {
      return;
    }
    var phpPattern = /<\?(?:[^"'/#]|\/(?![*/])|("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|(?:\/\/|#(?!\[))(?:[^?\n\r]|\?(?!>))*(?=$|\?>|[\r\n])|#\[|\/\*(?:[^*]|\*(?!\/))*(?:\*\/|$))*?(?:\?>|$)/g;
    Prism3.languages["markup-templating"].buildPlaceholders(env, "php", phpPattern);
  });
  Prism3.hooks.add("after-tokenize", function(env) {
    Prism3.languages["markup-templating"].tokenizePlaceholders(env, "php");
  });
})(Prism);

// node_modules/prismjs/components/prism-ruby.js
(function(Prism3) {
  Prism3.languages.ruby = Prism3.languages.extend("clike", {
    "comment": {
      pattern: /#.*|^=begin\s[\s\S]*?^=end/m,
      greedy: true
    },
    "class-name": {
      pattern: /(\b(?:class|module)\s+|\bcatch\s+\()[\w.\\]+|\b[A-Z_]\w*(?=\s*\.\s*new\b)/,
      lookbehind: true,
      inside: {
        "punctuation": /[.\\]/
      }
    },
    "keyword": /\b(?:BEGIN|END|alias|and|begin|break|case|class|def|define_method|defined|do|each|else|elsif|end|ensure|extend|for|if|in|include|module|new|next|nil|not|or|prepend|private|protected|public|raise|redo|require|rescue|retry|return|self|super|then|throw|undef|unless|until|when|while|yield)\b/,
    "operator": /\.{2,3}|&\.|===|<?=>|[!=]?~|(?:&&|\|\||<<|>>|\*\*|[+\-*/%<>!^&|=])=?|[?:]/,
    "punctuation": /[(){}[\].,;]/
  });
  Prism3.languages.insertBefore("ruby", "operator", {
    "double-colon": {
      pattern: /::/,
      alias: "punctuation"
    }
  });
  var interpolation = {
    pattern: /((?:^|[^\\])(?:\\{2})*)#\{(?:[^{}]|\{[^{}]*\})*\}/,
    lookbehind: true,
    inside: {
      "content": {
        pattern: /^(#\{)[\s\S]+(?=\}$)/,
        lookbehind: true,
        inside: Prism3.languages.ruby
      },
      "delimiter": {
        pattern: /^#\{|\}$/,
        alias: "punctuation"
      }
    }
  };
  delete Prism3.languages.ruby.function;
  var percentExpression = "(?:" + [
    /([^a-zA-Z0-9\s{(\[<=])(?:(?!\1)[^\\]|\\[\s\S])*\1/.source,
    /\((?:[^()\\]|\\[\s\S]|\((?:[^()\\]|\\[\s\S])*\))*\)/.source,
    /\{(?:[^{}\\]|\\[\s\S]|\{(?:[^{}\\]|\\[\s\S])*\})*\}/.source,
    /\[(?:[^\[\]\\]|\\[\s\S]|\[(?:[^\[\]\\]|\\[\s\S])*\])*\]/.source,
    /<(?:[^<>\\]|\\[\s\S]|<(?:[^<>\\]|\\[\s\S])*>)*>/.source
  ].join("|") + ")";
  var symbolName = /(?:"(?:\\.|[^"\\\r\n])*"|(?:\b[a-zA-Z_]\w*|[^\s\0-\x7F]+)[?!]?|\$.)/.source;
  Prism3.languages.insertBefore("ruby", "keyword", {
    "regex-literal": [
      {
        pattern: RegExp(/%r/.source + percentExpression + /[egimnosux]{0,6}/.source),
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "regex": /[\s\S]+/
        }
      },
      {
        pattern: /(^|[^/])\/(?!\/)(?:\[[^\r\n\]]+\]|\\.|[^[/\\\r\n])+\/[egimnosux]{0,6}(?=\s*(?:$|[\r\n,.;})#]))/,
        lookbehind: true,
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "regex": /[\s\S]+/
        }
      }
    ],
    "variable": /[@$]+[a-zA-Z_]\w*(?:[?!]|\b)/,
    "symbol": [
      {
        pattern: RegExp(/(^|[^:]):/.source + symbolName),
        lookbehind: true,
        greedy: true
      },
      {
        pattern: RegExp(/([\r\n{(,][ \t]*)/.source + symbolName + /(?=:(?!:))/.source),
        lookbehind: true,
        greedy: true
      }
    ],
    "method-definition": {
      pattern: /(\bdef\s+)\w+(?:\s*\.\s*\w+)?/,
      lookbehind: true,
      inside: {
        "function": /\b\w+$/,
        "keyword": /^self\b/,
        "class-name": /^\w+/,
        "punctuation": /\./
      }
    }
  });
  Prism3.languages.insertBefore("ruby", "string", {
    "string-literal": [
      {
        pattern: RegExp(/%[qQiIwWs]?/.source + percentExpression),
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "string": /[\s\S]+/
        }
      },
      {
        pattern: /("|')(?:#\{[^}]+\}|#(?!\{)|\\(?:\r\n|[\s\S])|(?!\1)[^\\#\r\n])*\1/,
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "string": /[\s\S]+/
        }
      },
      {
        pattern: /<<[-~]?([a-z_]\w*)[\r\n](?:.*[\r\n])*?[\t ]*\1/i,
        alias: "heredoc-string",
        greedy: true,
        inside: {
          "delimiter": {
            pattern: /^<<[-~]?[a-z_]\w*|\b[a-z_]\w*$/i,
            inside: {
              "symbol": /\b\w+/,
              "punctuation": /^<<[-~]?/
            }
          },
          "interpolation": interpolation,
          "string": /[\s\S]+/
        }
      },
      {
        pattern: /<<[-~]?'([a-z_]\w*)'[\r\n](?:.*[\r\n])*?[\t ]*\1/i,
        alias: "heredoc-string",
        greedy: true,
        inside: {
          "delimiter": {
            pattern: /^<<[-~]?'[a-z_]\w*'|\b[a-z_]\w*$/i,
            inside: {
              "symbol": /\b\w+/,
              "punctuation": /^<<[-~]?'|'$/
            }
          },
          "string": /[\s\S]+/
        }
      }
    ],
    "command-literal": [
      {
        pattern: RegExp(/%x/.source + percentExpression),
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "command": {
            pattern: /[\s\S]+/,
            alias: "string"
          }
        }
      },
      {
        pattern: /`(?:#\{[^}]+\}|#(?!\{)|\\(?:\r\n|[\s\S])|[^\\`#\r\n])*`/,
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "command": {
            pattern: /[\s\S]+/,
            alias: "string"
          }
        }
      }
    ]
  });
  delete Prism3.languages.ruby.string;
  Prism3.languages.insertBefore("ruby", "number", {
    "builtin": /\b(?:Array|Bignum|Binding|Class|Continuation|Dir|Exception|FalseClass|File|Fixnum|Float|Hash|IO|Integer|MatchData|Method|Module|NilClass|Numeric|Object|Proc|Range|Regexp|Stat|String|Struct|Symbol|TMS|Thread|ThreadGroup|Time|TrueClass)\b/,
    "constant": /\b[A-Z][A-Z0-9_]*(?:[?!]|\b)/
  });
  Prism3.languages.rb = Prism3.languages.ruby;
})(Prism);

// node_modules/prismjs/components/prism-sql.js
Prism.languages.sql = {
  "comment": {
    pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|(?:--|\/\/|#).*)/,
    lookbehind: true
  },
  "variable": [
    {
      pattern: /@(["'`])(?:\\[\s\S]|(?!\1)[^\\])+\1/,
      greedy: true
    },
    /@[\w.$]+/
  ],
  "string": {
    pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\]|\2\2)*\2/,
    greedy: true,
    lookbehind: true
  },
  "identifier": {
    pattern: /(^|[^@\\])`(?:\\[\s\S]|[^`\\]|``)*`/,
    greedy: true,
    lookbehind: true,
    inside: {
      "punctuation": /^`|`$/
    }
  },
  "function": /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE)(?=\s*\()/i,
  // Should we highlight user defined functions too?
  "keyword": /\b(?:ACTION|ADD|AFTER|ALGORITHM|ALL|ALTER|ANALYZE|ANY|APPLY|AS|ASC|AUTHORIZATION|AUTO_INCREMENT|BACKUP|BDB|BEGIN|BERKELEYDB|BIGINT|BINARY|BIT|BLOB|BOOL|BOOLEAN|BREAK|BROWSE|BTREE|BULK|BY|CALL|CASCADED?|CASE|CHAIN|CHAR(?:ACTER|SET)?|CHECK(?:POINT)?|CLOSE|CLUSTERED|COALESCE|COLLATE|COLUMNS?|COMMENT|COMMIT(?:TED)?|COMPUTE|CONNECT|CONSISTENT|CONSTRAINT|CONTAINS(?:TABLE)?|CONTINUE|CONVERT|CREATE|CROSS|CURRENT(?:_DATE|_TIME|_TIMESTAMP|_USER)?|CURSOR|CYCLE|DATA(?:BASES?)?|DATE(?:TIME)?|DAY|DBCC|DEALLOCATE|DEC|DECIMAL|DECLARE|DEFAULT|DEFINER|DELAYED|DELETE|DELIMITERS?|DENY|DESC|DESCRIBE|DETERMINISTIC|DISABLE|DISCARD|DISK|DISTINCT|DISTINCTROW|DISTRIBUTED|DO|DOUBLE|DROP|DUMMY|DUMP(?:FILE)?|DUPLICATE|ELSE(?:IF)?|ENABLE|ENCLOSED|END|ENGINE|ENUM|ERRLVL|ERRORS|ESCAPED?|EXCEPT|EXEC(?:UTE)?|EXISTS|EXIT|EXPLAIN|EXTENDED|FETCH|FIELDS|FILE|FILLFACTOR|FIRST|FIXED|FLOAT|FOLLOWING|FOR(?: EACH ROW)?|FORCE|FOREIGN|FREETEXT(?:TABLE)?|FROM|FULL|FUNCTION|GEOMETRY(?:COLLECTION)?|GLOBAL|GOTO|GRANT|GROUP|HANDLER|HASH|HAVING|HOLDLOCK|HOUR|IDENTITY(?:COL|_INSERT)?|IF|IGNORE|IMPORT|INDEX|INFILE|INNER|INNODB|INOUT|INSERT|INT|INTEGER|INTERSECT|INTERVAL|INTO|INVOKER|ISOLATION|ITERATE|JOIN|KEYS?|KILL|LANGUAGE|LAST|LEAVE|LEFT|LEVEL|LIMIT|LINENO|LINES|LINESTRING|LOAD|LOCAL|LOCK|LONG(?:BLOB|TEXT)|LOOP|MATCH(?:ED)?|MEDIUM(?:BLOB|INT|TEXT)|MERGE|MIDDLEINT|MINUTE|MODE|MODIFIES|MODIFY|MONTH|MULTI(?:LINESTRING|POINT|POLYGON)|NATIONAL|NATURAL|NCHAR|NEXT|NO|NONCLUSTERED|NULLIF|NUMERIC|OFF?|OFFSETS?|ON|OPEN(?:DATASOURCE|QUERY|ROWSET)?|OPTIMIZE|OPTION(?:ALLY)?|ORDER|OUT(?:ER|FILE)?|OVER|PARTIAL|PARTITION|PERCENT|PIVOT|PLAN|POINT|POLYGON|PRECEDING|PRECISION|PREPARE|PREV|PRIMARY|PRINT|PRIVILEGES|PROC(?:EDURE)?|PUBLIC|PURGE|QUICK|RAISERROR|READS?|REAL|RECONFIGURE|REFERENCES|RELEASE|RENAME|REPEAT(?:ABLE)?|REPLACE|REPLICATION|REQUIRE|RESIGNAL|RESTORE|RESTRICT|RETURN(?:ING|S)?|REVOKE|RIGHT|ROLLBACK|ROUTINE|ROW(?:COUNT|GUIDCOL|S)?|RTREE|RULE|SAVE(?:POINT)?|SCHEMA|SECOND|SELECT|SERIAL(?:IZABLE)?|SESSION(?:_USER)?|SET(?:USER)?|SHARE|SHOW|SHUTDOWN|SIMPLE|SMALLINT|SNAPSHOT|SOME|SONAME|SQL|START(?:ING)?|STATISTICS|STATUS|STRIPED|SYSTEM_USER|TABLES?|TABLESPACE|TEMP(?:ORARY|TABLE)?|TERMINATED|TEXT(?:SIZE)?|THEN|TIME(?:STAMP)?|TINY(?:BLOB|INT|TEXT)|TOP?|TRAN(?:SACTIONS?)?|TRIGGER|TRUNCATE|TSEQUAL|TYPES?|UNBOUNDED|UNCOMMITTED|UNDEFINED|UNION|UNIQUE|UNLOCK|UNPIVOT|UNSIGNED|UPDATE(?:TEXT)?|USAGE|USE|USER|USING|VALUES?|VAR(?:BINARY|CHAR|CHARACTER|YING)|VIEW|WAITFOR|WARNINGS|WHEN|WHERE|WHILE|WITH(?: ROLLUP|IN)?|WORK|WRITE(?:TEXT)?|YEAR)\b/i,
  "boolean": /\b(?:FALSE|NULL|TRUE)\b/i,
  "number": /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?|\B\.\d+\b/i,
  "operator": /[-+*\/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|DIV|ILIKE|IN|IS|LIKE|NOT|OR|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
  "punctuation": /[;[\]()`,.]/
};

// node_modules/prismjs/components/prism-yaml.js
(function(Prism3) {
  var anchorOrAlias = /[*&][^\s[\]{},]+/;
  var tag = /!(?:<[\w\-%#;/?:@&=+$,.!~*'()[\]]+>|(?:[a-zA-Z\d-]*!)?[\w\-%#;/?:@&=+$.~*'()]+)?/;
  var properties = "(?:" + tag.source + "(?:[ 	]+" + anchorOrAlias.source + ")?|" + anchorOrAlias.source + "(?:[ 	]+" + tag.source + ")?)";
  var plainKey = /(?:[^\s\x00-\x08\x0e-\x1f!"#%&'*,\-:>?@[\]`{|}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]|[?:-]<PLAIN>)(?:[ \t]*(?:(?![#:])<PLAIN>|:<PLAIN>))*/.source.replace(/<PLAIN>/g, function() {
    return /[^\s\x00-\x08\x0e-\x1f,[\]{}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]/.source;
  });
  var string = /"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'/.source;
  function createValuePattern(value, flags) {
    flags = (flags || "").replace(/m/g, "") + "m";
    var pattern = /([:\-,[{]\s*(?:\s<<prop>>[ \t]+)?)(?:<<value>>)(?=[ \t]*(?:$|,|\]|\}|(?:[\r\n]\s*)?#))/.source.replace(/<<prop>>/g, function() {
      return properties;
    }).replace(/<<value>>/g, function() {
      return value;
    });
    return RegExp(pattern, flags);
  }
  Prism3.languages.yaml = {
    "scalar": {
      pattern: RegExp(/([\-:]\s*(?:\s<<prop>>[ \t]+)?[|>])[ \t]*(?:((?:\r?\n|\r)[ \t]+)\S[^\r\n]*(?:\2[^\r\n]+)*)/.source.replace(/<<prop>>/g, function() {
        return properties;
      })),
      lookbehind: true,
      alias: "string"
    },
    "comment": /#.*/,
    "key": {
      pattern: RegExp(/((?:^|[:\-,[{\r\n?])[ \t]*(?:<<prop>>[ \t]+)?)<<key>>(?=\s*:\s)/.source.replace(/<<prop>>/g, function() {
        return properties;
      }).replace(/<<key>>/g, function() {
        return "(?:" + plainKey + "|" + string + ")";
      })),
      lookbehind: true,
      greedy: true,
      alias: "atrule"
    },
    "directive": {
      pattern: /(^[ \t]*)%.+/m,
      lookbehind: true,
      alias: "important"
    },
    "datetime": {
      pattern: createValuePattern(/\d{4}-\d\d?-\d\d?(?:[tT]|[ \t]+)\d\d?:\d{2}:\d{2}(?:\.\d*)?(?:[ \t]*(?:Z|[-+]\d\d?(?::\d{2})?))?|\d{4}-\d{2}-\d{2}|\d\d?:\d{2}(?::\d{2}(?:\.\d*)?)?/.source),
      lookbehind: true,
      alias: "number"
    },
    "boolean": {
      pattern: createValuePattern(/false|true/.source, "i"),
      lookbehind: true,
      alias: "important"
    },
    "null": {
      pattern: createValuePattern(/null|~/.source, "i"),
      lookbehind: true,
      alias: "important"
    },
    "string": {
      pattern: createValuePattern(string),
      lookbehind: true,
      greedy: true
    },
    "number": {
      pattern: createValuePattern(/[+-]?(?:0x[\da-f]+|0o[0-7]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\.inf|\.nan)/.source, "i"),
      lookbehind: true
    },
    "tag": tag,
    "important": anchorOrAlias,
    "punctuation": /---|[:[\]{}\-,|>?]|\.\.\./
  };
  Prism3.languages.yml = Prism3.languages.yaml;
})(Prism);

// node_modules/prismjs/components/prism-markdown.js
(function(Prism3) {
  var inner = /(?:\\.|[^\\\n\r]|(?:\n|\r\n?)(?![\r\n]))/.source;
  function createInline(pattern) {
    pattern = pattern.replace(/<inner>/g, function() {
      return inner;
    });
    return RegExp(/((?:^|[^\\])(?:\\{2})*)/.source + "(?:" + pattern + ")");
  }
  var tableCell = /(?:\\.|``(?:[^`\r\n]|`(?!`))+``|`[^`\r\n]+`|[^\\|\r\n`])+/.source;
  var tableRow = /\|?__(?:\|__)+\|?(?:(?:\n|\r\n?)|(?![\s\S]))/.source.replace(/__/g, function() {
    return tableCell;
  });
  var tableLine = /\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?(?:\n|\r\n?)/.source;
  Prism3.languages.markdown = Prism3.languages.extend("markup", {});
  Prism3.languages.insertBefore("markdown", "prolog", {
    "front-matter-block": {
      pattern: /(^(?:\s*[\r\n])?)---(?!.)[\s\S]*?[\r\n]---(?!.)/,
      lookbehind: true,
      greedy: true,
      inside: {
        "punctuation": /^---|---$/,
        "front-matter": {
          pattern: /\S+(?:\s+\S+)*/,
          alias: ["yaml", "language-yaml"],
          inside: Prism3.languages.yaml
        }
      }
    },
    "blockquote": {
      // > ...
      pattern: /^>(?:[\t ]*>)*/m,
      alias: "punctuation"
    },
    "table": {
      pattern: RegExp("^" + tableRow + tableLine + "(?:" + tableRow + ")*", "m"),
      inside: {
        "table-data-rows": {
          pattern: RegExp("^(" + tableRow + tableLine + ")(?:" + tableRow + ")*$"),
          lookbehind: true,
          inside: {
            "table-data": {
              pattern: RegExp(tableCell),
              inside: Prism3.languages.markdown
            },
            "punctuation": /\|/
          }
        },
        "table-line": {
          pattern: RegExp("^(" + tableRow + ")" + tableLine + "$"),
          lookbehind: true,
          inside: {
            "punctuation": /\||:?-{3,}:?/
          }
        },
        "table-header-row": {
          pattern: RegExp("^" + tableRow + "$"),
          inside: {
            "table-header": {
              pattern: RegExp(tableCell),
              alias: "important",
              inside: Prism3.languages.markdown
            },
            "punctuation": /\|/
          }
        }
      }
    },
    "code": [
      {
        // Prefixed by 4 spaces or 1 tab and preceded by an empty line
        pattern: /((?:^|\n)[ \t]*\n|(?:^|\r\n?)[ \t]*\r\n?)(?: {4}|\t).+(?:(?:\n|\r\n?)(?: {4}|\t).+)*/,
        lookbehind: true,
        alias: "keyword"
      },
      {
        // ```optional language
        // code block
        // ```
        pattern: /^```[\s\S]*?^```$/m,
        greedy: true,
        inside: {
          "code-block": {
            pattern: /^(```.*(?:\n|\r\n?))[\s\S]+?(?=(?:\n|\r\n?)^```$)/m,
            lookbehind: true
          },
          "code-language": {
            pattern: /^(```).+/,
            lookbehind: true
          },
          "punctuation": /```/
        }
      }
    ],
    "title": [
      {
        // title 1
        // =======
        // title 2
        // -------
        pattern: /\S.*(?:\n|\r\n?)(?:==+|--+)(?=[ \t]*$)/m,
        alias: "important",
        inside: {
          punctuation: /==+$|--+$/
        }
      },
      {
        // # title 1
        // ###### title 6
        pattern: /(^\s*)#.+/m,
        lookbehind: true,
        alias: "important",
        inside: {
          punctuation: /^#+|#+$/
        }
      }
    ],
    "hr": {
      // ***
      // ---
      // * * *
      // -----------
      pattern: /(^\s*)([*-])(?:[\t ]*\2){2,}(?=\s*$)/m,
      lookbehind: true,
      alias: "punctuation"
    },
    "list": {
      // * item
      // + item
      // - item
      // 1. item
      pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
      lookbehind: true,
      alias: "punctuation"
    },
    "url-reference": {
      // [id]: http://example.com "Optional title"
      // [id]: http://example.com 'Optional title'
      // [id]: http://example.com (Optional title)
      // [id]: <http://example.com> "Optional title"
      pattern: /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
      inside: {
        "variable": {
          pattern: /^(!?\[)[^\]]+/,
          lookbehind: true
        },
        "string": /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
        "punctuation": /^[\[\]!:]|[<>]/
      },
      alias: "url"
    },
    "bold": {
      // **strong**
      // __strong__
      // allow one nested instance of italic text using the same delimiter
      pattern: createInline(/\b__(?:(?!_)<inner>|_(?:(?!_)<inner>)+_)+__\b|\*\*(?:(?!\*)<inner>|\*(?:(?!\*)<inner>)+\*)+\*\*/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "content": {
          pattern: /(^..)[\s\S]+(?=..$)/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "punctuation": /\*\*|__/
      }
    },
    "italic": {
      // *em*
      // _em_
      // allow one nested instance of bold text using the same delimiter
      pattern: createInline(/\b_(?:(?!_)<inner>|__(?:(?!_)<inner>)+__)+_\b|\*(?:(?!\*)<inner>|\*\*(?:(?!\*)<inner>)+\*\*)+\*/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "content": {
          pattern: /(^.)[\s\S]+(?=.$)/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "punctuation": /[*_]/
      }
    },
    "strike": {
      // ~~strike through~~
      // ~strike~
      // eslint-disable-next-line regexp/strict
      pattern: createInline(/(~~?)(?:(?!~)<inner>)+\2/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "content": {
          pattern: /(^~~?)[\s\S]+(?=\1$)/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "punctuation": /~~?/
      }
    },
    "code-snippet": {
      // `code`
      // ``code``
      pattern: /(^|[^\\`])(?:``[^`\r\n]+(?:`[^`\r\n]+)*``(?!`)|`[^`\r\n]+`(?!`))/,
      lookbehind: true,
      greedy: true,
      alias: ["code", "keyword"]
    },
    "url": {
      // [example](http://example.com "Optional title")
      // [example][id]
      // [example] [id]
      pattern: createInline(/!?\[(?:(?!\])<inner>)+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)|[ \t]?\[(?:(?!\])<inner>)+\])/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "operator": /^!/,
        "content": {
          pattern: /(^\[)[^\]]+(?=\])/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "variable": {
          pattern: /(^\][ \t]?\[)[^\]]+(?=\]$)/,
          lookbehind: true
        },
        "url": {
          pattern: /(^\]\()[^\s)]+/,
          lookbehind: true
        },
        "string": {
          pattern: /(^[ \t]+)"(?:\\.|[^"\\])*"(?=\)$)/,
          lookbehind: true
        }
      }
    }
  });
  ["url", "bold", "italic", "strike"].forEach(function(token) {
    ["url", "bold", "italic", "strike", "code-snippet"].forEach(function(inside) {
      if (token !== inside) {
        Prism3.languages.markdown[token].inside.content.inside[inside] = Prism3.languages.markdown[inside];
      }
    });
  });
  Prism3.hooks.add("after-tokenize", function(env) {
    if (env.language !== "markdown" && env.language !== "md") {
      return;
    }
    function walkTokens(tokens) {
      if (!tokens || typeof tokens === "string") {
        return;
      }
      for (var i = 0, l = tokens.length; i < l; i++) {
        var token = tokens[i];
        if (token.type !== "code") {
          walkTokens(token.content);
          continue;
        }
        var codeLang = token.content[1];
        var codeBlock = token.content[3];
        if (codeLang && codeBlock && codeLang.type === "code-language" && codeBlock.type === "code-block" && typeof codeLang.content === "string") {
          var lang = codeLang.content.replace(/\b#/g, "sharp").replace(/\b\+\+/g, "pp");
          lang = (/[a-z][\w-]*/i.exec(lang) || [""])[0].toLowerCase();
          var alias = "language-" + lang;
          if (!codeBlock.alias) {
            codeBlock.alias = [alias];
          } else if (typeof codeBlock.alias === "string") {
            codeBlock.alias = [codeBlock.alias, alias];
          } else {
            codeBlock.alias.push(alias);
          }
        }
      }
    }
    walkTokens(env.tokens);
  });
  Prism3.hooks.add("wrap", function(env) {
    if (env.type !== "code-block") {
      return;
    }
    var codeLang = "";
    for (var i = 0, l = env.classes.length; i < l; i++) {
      var cls = env.classes[i];
      var match = /language-(.+)/.exec(cls);
      if (match) {
        codeLang = match[1];
        break;
      }
    }
    var grammar = Prism3.languages[codeLang];
    if (!grammar) {
      if (codeLang && codeLang !== "none" && Prism3.plugins.autoloader) {
        var id = "md-" + (/* @__PURE__ */ new Date()).valueOf() + "-" + Math.floor(Math.random() * 1e16);
        env.attributes["id"] = id;
        Prism3.plugins.autoloader.loadLanguages(codeLang, function() {
          var ele = document.getElementById(id);
          if (ele) {
            ele.innerHTML = Prism3.highlight(ele.textContent, Prism3.languages[codeLang], codeLang);
          }
        });
      }
    } else {
      env.content = Prism3.highlight(textContent(env.content), grammar, codeLang);
    }
  });
  var tagPattern = RegExp(Prism3.languages.markup.tag.pattern.source, "gi");
  var KNOWN_ENTITY_NAMES = {
    "amp": "&",
    "lt": "<",
    "gt": ">",
    "quot": '"'
  };
  var fromCodePoint = String.fromCodePoint || String.fromCharCode;
  function textContent(html) {
    var text = html.replace(tagPattern, "");
    text = text.replace(/&(\w{1,8}|#x?[\da-f]{1,8});/gi, function(m, code) {
      code = code.toLowerCase();
      if (code[0] === "#") {
        var value;
        if (code[1] === "x") {
          value = parseInt(code.slice(2), 16);
        } else {
          value = Number(code.slice(1));
        }
        return fromCodePoint(value);
      } else {
        var known = KNOWN_ENTITY_NAMES[code];
        if (known) {
          return known;
        }
        return m;
      }
    });
    return text;
  }
  Prism3.languages.md = Prism3.languages.markdown;
})(Prism);

// node_modules/prismjs/components/prism-docker.js
(function(Prism3) {
  var spaceAfterBackSlash = /\\[\r\n](?:\s|\\[\r\n]|#.*(?!.))*(?![\s#]|\\[\r\n])/.source;
  var space = /(?:[ \t]+(?![ \t])(?:<SP_BS>)?|<SP_BS>)/.source.replace(/<SP_BS>/g, function() {
    return spaceAfterBackSlash;
  });
  var string = /"(?:[^"\\\r\n]|\\(?:\r\n|[\s\S]))*"|'(?:[^'\\\r\n]|\\(?:\r\n|[\s\S]))*'/.source;
  var option = /--[\w-]+=(?:<STR>|(?!["'])(?:[^\s\\]|\\.)+)/.source.replace(/<STR>/g, function() {
    return string;
  });
  var stringRule = {
    pattern: RegExp(string),
    greedy: true
  };
  var commentRule = {
    pattern: /(^[ \t]*)#.*/m,
    lookbehind: true,
    greedy: true
  };
  function re(source, flags) {
    source = source.replace(/<OPT>/g, function() {
      return option;
    }).replace(/<SP>/g, function() {
      return space;
    });
    return RegExp(source, flags);
  }
  Prism3.languages.docker = {
    "instruction": {
      pattern: /(^[ \t]*)(?:ADD|ARG|CMD|COPY|ENTRYPOINT|ENV|EXPOSE|FROM|HEALTHCHECK|LABEL|MAINTAINER|ONBUILD|RUN|SHELL|STOPSIGNAL|USER|VOLUME|WORKDIR)(?=\s)(?:\\.|[^\r\n\\])*(?:\\$(?:\s|#.*$)*(?![\s#])(?:\\.|[^\r\n\\])*)*/im,
      lookbehind: true,
      greedy: true,
      inside: {
        "options": {
          pattern: re(/(^(?:ONBUILD<SP>)?\w+<SP>)<OPT>(?:<SP><OPT>)*/.source, "i"),
          lookbehind: true,
          greedy: true,
          inside: {
            "property": {
              pattern: /(^|\s)--[\w-]+/,
              lookbehind: true
            },
            "string": [
              stringRule,
              {
                pattern: /(=)(?!["'])(?:[^\s\\]|\\.)+/,
                lookbehind: true
              }
            ],
            "operator": /\\$/m,
            "punctuation": /=/
          }
        },
        "keyword": [
          {
            // https://docs.docker.com/engine/reference/builder/#healthcheck
            pattern: re(/(^(?:ONBUILD<SP>)?HEALTHCHECK<SP>(?:<OPT><SP>)*)(?:CMD|NONE)\b/.source, "i"),
            lookbehind: true,
            greedy: true
          },
          {
            // https://docs.docker.com/engine/reference/builder/#from
            pattern: re(/(^(?:ONBUILD<SP>)?FROM<SP>(?:<OPT><SP>)*(?!--)[^ \t\\]+<SP>)AS/.source, "i"),
            lookbehind: true,
            greedy: true
          },
          {
            // https://docs.docker.com/engine/reference/builder/#onbuild
            pattern: re(/(^ONBUILD<SP>)\w+/.source, "i"),
            lookbehind: true,
            greedy: true
          },
          {
            pattern: /^\w+/,
            greedy: true
          }
        ],
        "comment": commentRule,
        "string": stringRule,
        "variable": /\$(?:\w+|\{[^{}"'\\]*\})/,
        "operator": /\\$/m
      }
    },
    "comment": commentRule
  };
  Prism3.languages.dockerfile = Prism3.languages.docker;
})(Prism);

// node_modules/prismjs/components/prism-nginx.js
(function(Prism3) {
  var variable = /\$(?:\w[a-z\d]*(?:_[^\x00-\x1F\s"'\\()$]*)?|\{[^}\s"'\\]+\})/i;
  Prism3.languages.nginx = {
    "comment": {
      pattern: /(^|[\s{};])#.*/,
      lookbehind: true,
      greedy: true
    },
    "directive": {
      pattern: /(^|\s)\w(?:[^;{}"'\\\s]|\\.|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\s+(?:#.*(?!.)|(?![#\s])))*?(?=\s*[;{])/,
      lookbehind: true,
      greedy: true,
      inside: {
        "string": {
          pattern: /((?:^|[^\\])(?:\\\\)*)(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
          lookbehind: true,
          greedy: true,
          inside: {
            "escape": {
              pattern: /\\["'\\nrt]/,
              alias: "entity"
            },
            "variable": variable
          }
        },
        "comment": {
          pattern: /(\s)#.*/,
          lookbehind: true,
          greedy: true
        },
        "keyword": {
          pattern: /^\S+/,
          greedy: true
        },
        // other patterns
        "boolean": {
          pattern: /(\s)(?:off|on)(?!\S)/,
          lookbehind: true
        },
        "number": {
          pattern: /(\s)\d+[a-z]*(?!\S)/i,
          lookbehind: true
        },
        "variable": variable
      }
    },
    "punctuation": /[{};]/
  };
})(Prism);

// node_modules/prismjs/components/prism-diff.js
(function(Prism3) {
  Prism3.languages.diff = {
    "coord": [
      // Match all kinds of coord lines (prefixed by "+++", "---" or "***").
      /^(?:\*{3}|-{3}|\+{3}).*$/m,
      // Match "@@ ... @@" coord lines in unified diff.
      /^@@.*@@$/m,
      // Match coord lines in normal diff (starts with a number).
      /^\d.*$/m
    ]
    // deleted, inserted, unchanged, diff
  };
  var PREFIXES = {
    "deleted-sign": "-",
    "deleted-arrow": "<",
    "inserted-sign": "+",
    "inserted-arrow": ">",
    "unchanged": " ",
    "diff": "!"
  };
  Object.keys(PREFIXES).forEach(function(name) {
    var prefix = PREFIXES[name];
    var alias = [];
    if (!/^\w+$/.test(name)) {
      alias.push(/\w+/.exec(name)[0]);
    }
    if (name === "diff") {
      alias.push("bold");
    }
    Prism3.languages.diff[name] = {
      pattern: RegExp("^(?:[" + prefix + "].*(?:\r\n?|\n|(?![\\s\\S])))+", "m"),
      alias,
      inside: {
        "line": {
          pattern: /(.)(?=[\s\S]).*(?:\r\n?|\n)?/,
          lookbehind: true
        },
        "prefix": {
          pattern: /[\s\S]/,
          alias: /\w+/.exec(name)[0]
        }
      }
    };
  });
  Object.defineProperty(Prism3.languages.diff, "PREFIXES", {
    value: PREFIXES
  });
})(Prism);

// node_modules/prismjs/components/prism-csharp.js
(function(Prism3) {
  function replace(pattern, replacements) {
    return pattern.replace(/<<(\d+)>>/g, function(m, index) {
      return "(?:" + replacements[+index] + ")";
    });
  }
  function re(pattern, replacements, flags) {
    return RegExp(replace(pattern, replacements), flags || "");
  }
  function nested(pattern, depthLog2) {
    for (var i = 0; i < depthLog2; i++) {
      pattern = pattern.replace(/<<self>>/g, function() {
        return "(?:" + pattern + ")";
      });
    }
    return pattern.replace(/<<self>>/g, "[^\\s\\S]");
  }
  var keywordKinds = {
    // keywords which represent a return or variable type
    type: "bool byte char decimal double dynamic float int long object sbyte short string uint ulong ushort var void",
    // keywords which are used to declare a type
    typeDeclaration: "class enum interface record struct",
    // contextual keywords
    // ("var" and "dynamic" are missing because they are used like types)
    contextual: "add alias and ascending async await by descending from(?=\\s*(?:\\w|$)) get global group into init(?=\\s*;) join let nameof not notnull on or orderby partial remove select set unmanaged value when where with(?=\\s*{)",
    // all other keywords
    other: "abstract as base break case catch checked const continue default delegate do else event explicit extern finally fixed for foreach goto if implicit in internal is lock namespace new null operator out override params private protected public readonly ref return sealed sizeof stackalloc static switch this throw try typeof unchecked unsafe using virtual volatile while yield"
  };
  function keywordsToPattern(words) {
    return "\\b(?:" + words.trim().replace(/ /g, "|") + ")\\b";
  }
  var typeDeclarationKeywords = keywordsToPattern(keywordKinds.typeDeclaration);
  var keywords = RegExp(keywordsToPattern(keywordKinds.type + " " + keywordKinds.typeDeclaration + " " + keywordKinds.contextual + " " + keywordKinds.other));
  var nonTypeKeywords = keywordsToPattern(keywordKinds.typeDeclaration + " " + keywordKinds.contextual + " " + keywordKinds.other);
  var nonContextualKeywords = keywordsToPattern(keywordKinds.type + " " + keywordKinds.typeDeclaration + " " + keywordKinds.other);
  var generic = nested(/<(?:[^<>;=+\-*/%&|^]|<<self>>)*>/.source, 2);
  var nestedRound = nested(/\((?:[^()]|<<self>>)*\)/.source, 2);
  var name = /@?\b[A-Za-z_]\w*\b/.source;
  var genericName = replace(/<<0>>(?:\s*<<1>>)?/.source, [name, generic]);
  var identifier = replace(/(?!<<0>>)<<1>>(?:\s*\.\s*<<1>>)*/.source, [nonTypeKeywords, genericName]);
  var array = /\[\s*(?:,\s*)*\]/.source;
  var typeExpressionWithoutTuple = replace(/<<0>>(?:\s*(?:\?\s*)?<<1>>)*(?:\s*\?)?/.source, [identifier, array]);
  var tupleElement = replace(/[^,()<>[\];=+\-*/%&|^]|<<0>>|<<1>>|<<2>>/.source, [generic, nestedRound, array]);
  var tuple = replace(/\(<<0>>+(?:,<<0>>+)+\)/.source, [tupleElement]);
  var typeExpression = replace(/(?:<<0>>|<<1>>)(?:\s*(?:\?\s*)?<<2>>)*(?:\s*\?)?/.source, [tuple, identifier, array]);
  var typeInside = {
    "keyword": keywords,
    "punctuation": /[<>()?,.:[\]]/
  };
  var character = /'(?:[^\r\n'\\]|\\.|\\[Uux][\da-fA-F]{1,8})'/.source;
  var regularString = /"(?:\\.|[^\\"\r\n])*"/.source;
  var verbatimString = /@"(?:""|\\[\s\S]|[^\\"])*"(?!")/.source;
  Prism3.languages.csharp = Prism3.languages.extend("clike", {
    "string": [
      {
        pattern: re(/(^|[^$\\])<<0>>/.source, [verbatimString]),
        lookbehind: true,
        greedy: true
      },
      {
        pattern: re(/(^|[^@$\\])<<0>>/.source, [regularString]),
        lookbehind: true,
        greedy: true
      }
    ],
    "class-name": [
      {
        // Using static
        // using static System.Math;
        pattern: re(/(\busing\s+static\s+)<<0>>(?=\s*;)/.source, [identifier]),
        lookbehind: true,
        inside: typeInside
      },
      {
        // Using alias (type)
        // using Project = PC.MyCompany.Project;
        pattern: re(/(\busing\s+<<0>>\s*=\s*)<<1>>(?=\s*;)/.source, [name, typeExpression]),
        lookbehind: true,
        inside: typeInside
      },
      {
        // Using alias (alias)
        // using Project = PC.MyCompany.Project;
        pattern: re(/(\busing\s+)<<0>>(?=\s*=)/.source, [name]),
        lookbehind: true
      },
      {
        // Type declarations
        // class Foo<A, B>
        // interface Foo<out A, B>
        pattern: re(/(\b<<0>>\s+)<<1>>/.source, [typeDeclarationKeywords, genericName]),
        lookbehind: true,
        inside: typeInside
      },
      {
        // Single catch exception declaration
        // catch(Foo)
        // (things like catch(Foo e) is covered by variable declaration)
        pattern: re(/(\bcatch\s*\(\s*)<<0>>/.source, [identifier]),
        lookbehind: true,
        inside: typeInside
      },
      {
        // Name of the type parameter of generic constraints
        // where Foo : class
        pattern: re(/(\bwhere\s+)<<0>>/.source, [name]),
        lookbehind: true
      },
      {
        // Casts and checks via as and is.
        // as Foo<A>, is Bar<B>
        // (things like if(a is Foo b) is covered by variable declaration)
        pattern: re(/(\b(?:is(?:\s+not)?|as)\s+)<<0>>/.source, [typeExpressionWithoutTuple]),
        lookbehind: true,
        inside: typeInside
      },
      {
        // Variable, field and parameter declaration
        // (Foo bar, Bar baz, Foo[,,] bay, Foo<Bar, FooBar<Bar>> bax)
        pattern: re(/\b<<0>>(?=\s+(?!<<1>>|with\s*\{)<<2>>(?:\s*[=,;:{)\]]|\s+(?:in|when)\b))/.source, [typeExpression, nonContextualKeywords, name]),
        inside: typeInside
      }
    ],
    "keyword": keywords,
    // https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/lexical-structure#literals
    "number": /(?:\b0(?:x[\da-f_]*[\da-f]|b[01_]*[01])|(?:\B\.\d+(?:_+\d+)*|\b\d+(?:_+\d+)*(?:\.\d+(?:_+\d+)*)?)(?:e[-+]?\d+(?:_+\d+)*)?)(?:[dflmu]|lu|ul)?\b/i,
    "operator": />>=?|<<=?|[-=]>|([-+&|])\1|~|\?\?=?|[-+*/%&|^!=<>]=?/,
    "punctuation": /\?\.?|::|[{}[\];(),.:]/
  });
  Prism3.languages.insertBefore("csharp", "number", {
    "range": {
      pattern: /\.\./,
      alias: "operator"
    }
  });
  Prism3.languages.insertBefore("csharp", "punctuation", {
    "named-parameter": {
      pattern: re(/([(,]\s*)<<0>>(?=\s*:)/.source, [name]),
      lookbehind: true,
      alias: "punctuation"
    }
  });
  Prism3.languages.insertBefore("csharp", "class-name", {
    "namespace": {
      // namespace Foo.Bar {}
      // using Foo.Bar;
      pattern: re(/(\b(?:namespace|using)\s+)<<0>>(?:\s*\.\s*<<0>>)*(?=\s*[;{])/.source, [name]),
      lookbehind: true,
      inside: {
        "punctuation": /\./
      }
    },
    "type-expression": {
      // default(Foo), typeof(Foo<Bar>), sizeof(int)
      pattern: re(/(\b(?:default|sizeof|typeof)\s*\(\s*(?!\s))(?:[^()\s]|\s(?!\s)|<<0>>)*(?=\s*\))/.source, [nestedRound]),
      lookbehind: true,
      alias: "class-name",
      inside: typeInside
    },
    "return-type": {
      // Foo<Bar> ForBar(); Foo IFoo.Bar() => 0
      // int this[int index] => 0; T IReadOnlyList<T>.this[int index] => this[index];
      // int Foo => 0; int Foo { get; set } = 0;
      pattern: re(/<<0>>(?=\s+(?:<<1>>\s*(?:=>|[({]|\.\s*this\s*\[)|this\s*\[))/.source, [typeExpression, identifier]),
      inside: typeInside,
      alias: "class-name"
    },
    "constructor-invocation": {
      // new List<Foo<Bar[]>> { }
      pattern: re(/(\bnew\s+)<<0>>(?=\s*[[({])/.source, [typeExpression]),
      lookbehind: true,
      inside: typeInside,
      alias: "class-name"
    },
    /*'explicit-implementation': {
    	// int IFoo<Foo>.Bar => 0; void IFoo<Foo<Foo>>.Foo<T>();
    	pattern: replace(/\b<<0>>(?=\.<<1>>)/, className, methodOrPropertyDeclaration),
    	inside: classNameInside,
    	alias: 'class-name'
    },*/
    "generic-method": {
      // foo<Bar>()
      pattern: re(/<<0>>\s*<<1>>(?=\s*\()/.source, [name, generic]),
      inside: {
        "function": re(/^<<0>>/.source, [name]),
        "generic": {
          pattern: RegExp(generic),
          alias: "class-name",
          inside: typeInside
        }
      }
    },
    "type-list": {
      // The list of types inherited or of generic constraints
      // class Foo<F> : Bar, IList<FooBar>
      // where F : Bar, IList<int>
      pattern: re(
        /\b((?:<<0>>\s+<<1>>|record\s+<<1>>\s*<<5>>|where\s+<<2>>)\s*:\s*)(?:<<3>>|<<4>>|<<1>>\s*<<5>>|<<6>>)(?:\s*,\s*(?:<<3>>|<<4>>|<<6>>))*(?=\s*(?:where|[{;]|=>|$))/.source,
        [typeDeclarationKeywords, genericName, name, typeExpression, keywords.source, nestedRound, /\bnew\s*\(\s*\)/.source]
      ),
      lookbehind: true,
      inside: {
        "record-arguments": {
          pattern: re(/(^(?!new\s*\()<<0>>\s*)<<1>>/.source, [genericName, nestedRound]),
          lookbehind: true,
          greedy: true,
          inside: Prism3.languages.csharp
        },
        "keyword": keywords,
        "class-name": {
          pattern: RegExp(typeExpression),
          greedy: true,
          inside: typeInside
        },
        "punctuation": /[,()]/
      }
    },
    "preprocessor": {
      pattern: /(^[\t ]*)#.*/m,
      lookbehind: true,
      alias: "property",
      inside: {
        // highlight preprocessor directives as keywords
        "directive": {
          pattern: /(#)\b(?:define|elif|else|endif|endregion|error|if|line|nullable|pragma|region|undef|warning)\b/,
          lookbehind: true,
          alias: "keyword"
        }
      }
    }
  });
  var regularStringOrCharacter = regularString + "|" + character;
  var regularStringCharacterOrComment = replace(/\/(?![*/])|\/\/[^\r\n]*[\r\n]|\/\*(?:[^*]|\*(?!\/))*\*\/|<<0>>/.source, [regularStringOrCharacter]);
  var roundExpression = nested(replace(/[^"'/()]|<<0>>|\(<<self>>*\)/.source, [regularStringCharacterOrComment]), 2);
  var attrTarget = /\b(?:assembly|event|field|method|module|param|property|return|type)\b/.source;
  var attr = replace(/<<0>>(?:\s*\(<<1>>*\))?/.source, [identifier, roundExpression]);
  Prism3.languages.insertBefore("csharp", "class-name", {
    "attribute": {
      // Attributes
      // [Foo], [Foo(1), Bar(2, Prop = "foo")], [return: Foo(1), Bar(2)], [assembly: Foo(Bar)]
      pattern: re(/((?:^|[^\s\w>)?])\s*\[\s*)(?:<<0>>\s*:\s*)?<<1>>(?:\s*,\s*<<1>>)*(?=\s*\])/.source, [attrTarget, attr]),
      lookbehind: true,
      greedy: true,
      inside: {
        "target": {
          pattern: re(/^<<0>>(?=\s*:)/.source, [attrTarget]),
          alias: "keyword"
        },
        "attribute-arguments": {
          pattern: re(/\(<<0>>*\)/.source, [roundExpression]),
          inside: Prism3.languages.csharp
        },
        "class-name": {
          pattern: RegExp(identifier),
          inside: {
            "punctuation": /\./
          }
        },
        "punctuation": /[:,]/
      }
    }
  });
  var formatString = /:[^}\r\n]+/.source;
  var mInterpolationRound = nested(replace(/[^"'/()]|<<0>>|\(<<self>>*\)/.source, [regularStringCharacterOrComment]), 2);
  var mInterpolation = replace(/\{(?!\{)(?:(?![}:])<<0>>)*<<1>>?\}/.source, [mInterpolationRound, formatString]);
  var sInterpolationRound = nested(replace(/[^"'/()]|\/(?!\*)|\/\*(?:[^*]|\*(?!\/))*\*\/|<<0>>|\(<<self>>*\)/.source, [regularStringOrCharacter]), 2);
  var sInterpolation = replace(/\{(?!\{)(?:(?![}:])<<0>>)*<<1>>?\}/.source, [sInterpolationRound, formatString]);
  function createInterpolationInside(interpolation, interpolationRound) {
    return {
      "interpolation": {
        pattern: re(/((?:^|[^{])(?:\{\{)*)<<0>>/.source, [interpolation]),
        lookbehind: true,
        inside: {
          "format-string": {
            pattern: re(/(^\{(?:(?![}:])<<0>>)*)<<1>>(?=\}$)/.source, [interpolationRound, formatString]),
            lookbehind: true,
            inside: {
              "punctuation": /^:/
            }
          },
          "punctuation": /^\{|\}$/,
          "expression": {
            pattern: /[\s\S]+/,
            alias: "language-csharp",
            inside: Prism3.languages.csharp
          }
        }
      },
      "string": /[\s\S]+/
    };
  }
  Prism3.languages.insertBefore("csharp", "string", {
    "interpolation-string": [
      {
        pattern: re(/(^|[^\\])(?:\$@|@\$)"(?:""|\\[\s\S]|\{\{|<<0>>|[^\\{"])*"/.source, [mInterpolation]),
        lookbehind: true,
        greedy: true,
        inside: createInterpolationInside(mInterpolation, mInterpolationRound)
      },
      {
        pattern: re(/(^|[^@\\])\$"(?:\\.|\{\{|<<0>>|[^\\"{])*"/.source, [sInterpolation]),
        lookbehind: true,
        greedy: true,
        inside: createInterpolationInside(sInterpolation, sInterpolationRound)
      }
    ],
    "char": {
      pattern: RegExp(character),
      greedy: true
    }
  });
  Prism3.languages.dotnet = Prism3.languages.cs = Prism3.languages.csharp;
})(Prism);

// node_modules/prismjs/components/prism-kotlin.js
(function(Prism3) {
  Prism3.languages.kotlin = Prism3.languages.extend("clike", {
    "keyword": {
      // The lookbehind prevents wrong highlighting of e.g. kotlin.properties.get
      pattern: /(^|[^.])\b(?:abstract|actual|annotation|as|break|by|catch|class|companion|const|constructor|continue|crossinline|data|do|dynamic|else|enum|expect|external|final|finally|for|fun|get|if|import|in|infix|init|inline|inner|interface|internal|is|lateinit|noinline|null|object|open|operator|out|override|package|private|protected|public|reified|return|sealed|set|super|suspend|tailrec|this|throw|to|try|typealias|val|var|vararg|when|where|while)\b/,
      lookbehind: true
    },
    "function": [
      {
        pattern: /(?:`[^\r\n`]+`|\b\w+)(?=\s*\()/,
        greedy: true
      },
      {
        pattern: /(\.)(?:`[^\r\n`]+`|\w+)(?=\s*\{)/,
        lookbehind: true,
        greedy: true
      }
    ],
    "number": /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*|0[bB][01]+(?:_[01]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?[fFL]?)\b/,
    "operator": /\+[+=]?|-[-=>]?|==?=?|!(?:!|==?)?|[\/*%<>]=?|[?:]:?|\.\.|&&|\|\||\b(?:and|inv|or|shl|shr|ushr|xor)\b/
  });
  delete Prism3.languages.kotlin["class-name"];
  var interpolationInside = {
    "interpolation-punctuation": {
      pattern: /^\$\{?|\}$/,
      alias: "punctuation"
    },
    "expression": {
      pattern: /[\s\S]+/,
      inside: Prism3.languages.kotlin
    }
  };
  Prism3.languages.insertBefore("kotlin", "string", {
    // https://kotlinlang.org/spec/expressions.html#string-interpolation-expressions
    "string-literal": [
      {
        pattern: /"""(?:[^$]|\$(?:(?!\{)|\{[^{}]*\}))*?"""/,
        alias: "multiline",
        inside: {
          "interpolation": {
            pattern: /\$(?:[a-z_]\w*|\{[^{}]*\})/i,
            inside: interpolationInside
          },
          "string": /[\s\S]+/
        }
      },
      {
        pattern: /"(?:[^"\\\r\n$]|\\.|\$(?:(?!\{)|\{[^{}]*\}))*"/,
        alias: "singleline",
        inside: {
          "interpolation": {
            pattern: /((?:^|[^\\])(?:\\{2})*)\$(?:[a-z_]\w*|\{[^{}]*\})/i,
            lookbehind: true,
            inside: interpolationInside
          },
          "string": /[\s\S]+/
        }
      }
    ],
    "char": {
      // https://kotlinlang.org/spec/expressions.html#character-literals
      pattern: /'(?:[^'\\\r\n]|\\(?:.|u[a-fA-F0-9]{0,4}))'/,
      greedy: true
    }
  });
  delete Prism3.languages.kotlin["string"];
  Prism3.languages.insertBefore("kotlin", "keyword", {
    "annotation": {
      pattern: /\B@(?:\w+:)?(?:[A-Z]\w*|\[[^\]]+\])/,
      alias: "builtin"
    }
  });
  Prism3.languages.insertBefore("kotlin", "function", {
    "label": {
      pattern: /\b\w+@|@\w+\b/,
      alias: "symbol"
    }
  });
  Prism3.languages.kt = Prism3.languages.kotlin;
  Prism3.languages.kts = Prism3.languages.kotlin;
})(Prism);

// node_modules/prismjs/components/prism-swift.js
Prism.languages.swift = {
  "comment": {
    // Nested comments are supported up to 2 levels
    pattern: /(^|[^\\:])(?:\/\/.*|\/\*(?:[^/*]|\/(?!\*)|\*(?!\/)|\/\*(?:[^*]|\*(?!\/))*\*\/)*\*\/)/,
    lookbehind: true,
    greedy: true
  },
  "string-literal": [
    // https://docs.swift.org/swift-book/LanguageGuide/StringsAndCharacters.html
    {
      pattern: RegExp(
        /(^|[^"#])/.source + "(?:" + /"(?:\\(?:\((?:[^()]|\([^()]*\))*\)|\r\n|[^(])|[^\\\r\n"])*"/.source + "|" + /"""(?:\\(?:\((?:[^()]|\([^()]*\))*\)|[^(])|[^\\"]|"(?!""))*"""/.source + ")" + /(?!["#])/.source
      ),
      lookbehind: true,
      greedy: true,
      inside: {
        "interpolation": {
          pattern: /(\\\()(?:[^()]|\([^()]*\))*(?=\))/,
          lookbehind: true,
          inside: null
          // see below
        },
        "interpolation-punctuation": {
          pattern: /^\)|\\\($/,
          alias: "punctuation"
        },
        "punctuation": /\\(?=[\r\n])/,
        "string": /[\s\S]+/
      }
    },
    {
      pattern: RegExp(
        /(^|[^"#])(#+)/.source + "(?:" + /"(?:\\(?:#+\((?:[^()]|\([^()]*\))*\)|\r\n|[^#])|[^\\\r\n])*?"/.source + "|" + /"""(?:\\(?:#+\((?:[^()]|\([^()]*\))*\)|[^#])|[^\\])*?"""/.source + ")\\2"
      ),
      lookbehind: true,
      greedy: true,
      inside: {
        "interpolation": {
          pattern: /(\\#+\()(?:[^()]|\([^()]*\))*(?=\))/,
          lookbehind: true,
          inside: null
          // see below
        },
        "interpolation-punctuation": {
          pattern: /^\)|\\#+\($/,
          alias: "punctuation"
        },
        "string": /[\s\S]+/
      }
    }
  ],
  "directive": {
    // directives with conditions
    pattern: RegExp(
      /#/.source + "(?:" + (/(?:elseif|if)\b/.source + "(?:[ 	]*" + /(?:![ \t]*)?(?:\b\w+\b(?:[ \t]*\((?:[^()]|\([^()]*\))*\))?|\((?:[^()]|\([^()]*\))*\))(?:[ \t]*(?:&&|\|\|))?/.source + ")+") + "|" + /(?:else|endif)\b/.source + ")"
    ),
    alias: "property",
    inside: {
      "directive-name": /^#\w+/,
      "boolean": /\b(?:false|true)\b/,
      "number": /\b\d+(?:\.\d+)*\b/,
      "operator": /!|&&|\|\||[<>]=?/,
      "punctuation": /[(),]/
    }
  },
  "literal": {
    pattern: /#(?:colorLiteral|column|dsohandle|file(?:ID|Literal|Path)?|function|imageLiteral|line)\b/,
    alias: "constant"
  },
  "other-directive": {
    pattern: /#\w+\b/,
    alias: "property"
  },
  "attribute": {
    pattern: /@\w+/,
    alias: "atrule"
  },
  "function-definition": {
    pattern: /(\bfunc\s+)\w+/,
    lookbehind: true,
    alias: "function"
  },
  "label": {
    // https://docs.swift.org/swift-book/LanguageGuide/ControlFlow.html#ID141
    pattern: /\b(break|continue)\s+\w+|\b[a-zA-Z_]\w*(?=\s*:\s*(?:for|repeat|while)\b)/,
    lookbehind: true,
    alias: "important"
  },
  "keyword": /\b(?:Any|Protocol|Self|Type|actor|as|assignment|associatedtype|associativity|async|await|break|case|catch|class|continue|convenience|default|defer|deinit|didSet|do|dynamic|else|enum|extension|fallthrough|fileprivate|final|for|func|get|guard|higherThan|if|import|in|indirect|infix|init|inout|internal|is|isolated|lazy|left|let|lowerThan|mutating|none|nonisolated|nonmutating|open|operator|optional|override|postfix|precedencegroup|prefix|private|protocol|public|repeat|required|rethrows|return|right|safe|self|set|some|static|struct|subscript|super|switch|throw|throws|try|typealias|unowned|unsafe|var|weak|where|while|willSet)\b/,
  "boolean": /\b(?:false|true)\b/,
  "nil": {
    pattern: /\bnil\b/,
    alias: "constant"
  },
  "short-argument": /\$\d+\b/,
  "omit": {
    pattern: /\b_\b/,
    alias: "keyword"
  },
  "number": /\b(?:[\d_]+(?:\.[\de_]+)?|0x[a-f0-9_]+(?:\.[a-f0-9p_]+)?|0b[01_]+|0o[0-7_]+)\b/i,
  // A class name must start with an upper-case letter and be either 1 letter long or contain a lower-case letter.
  "class-name": /\b[A-Z](?:[A-Z_\d]*[a-z]\w*)?\b/,
  "function": /\b[a-z_]\w*(?=\s*\()/i,
  "constant": /\b(?:[A-Z_]{2,}|k[A-Z][A-Za-z_]+)\b/,
  // Operators are generic in Swift. Developers can even create new operators (e.g. +++).
  // https://docs.swift.org/swift-book/ReferenceManual/zzSummaryOfTheGrammar.html#ID481
  // This regex only supports ASCII operators.
  "operator": /[-+*/%=!<>&|^~?]+|\.[.\-+*/%=!<>&|^~?]+/,
  "punctuation": /[{}[\]();,.:\\]/
};
Prism.languages.swift["string-literal"].forEach(function(rule) {
  rule.inside["interpolation"].inside = Prism.languages.swift;
});

// public/js/prism-bundle.js
window.Prism = import_prismjs.default;

// public/js/api-client.js
var ApiClient = {
  _token: null,
  setToken(token) {
    this._token = token;
  },
  getToken() {
    return this._token;
  },
  headers(extra = {}) {
    const h = { ...extra };
    if (this._token) {
      h["Authorization"] = `Bearer ${this._token}`;
    }
    return h;
  },
  async request(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: this.headers(options.headers || {})
    });
    return res;
  },
  async get(url) {
    const res = await this.request(url);
    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status}`);
    }
    return res.json();
  },
  async getRaw(url) {
    const res = await this.request(url);
    return res;
  },
  async post(url, body) {
    const res = await this.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : void 0
    });
    return res.json().catch(() => null);
  },
  async postRaw(url, body) {
    const res = await this.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : void 0
    });
    return res;
  },
  async put(url, body) {
    const res = await this.request(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : void 0
    });
    return res.json().catch(() => null);
  },
  async del(url, body) {
    const res = await this.request(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : void 0
    });
    return res.json().catch(() => null);
  }
};
var api_client_default = ApiClient;

// public/js/utils.js
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text || "");
  return div.innerHTML;
}
function isValidUrl(url) {
  if (url.startsWith("/api/file/")) return true;
  try {
    const urlWithProtocol = url.match(/^https?:\/\//) ? url : "https://" + url;
    const parsed = new URL(urlWithProtocol);
    if (!url.match(/^https?:\/\//)) {
      const domain = parsed.hostname;
      if (!domain || !domain.includes(".") || domain.split(".").pop().length < 2) {
        return false;
      }
    }
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_e) {
    return false;
  }
}
function sanitizeUrl(url) {
  if (!isValidUrl(url)) return "#";
  const safeUrl = url.match(/^https?:\/\//) ? url : "https://" + url;
  return safeUrl.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2);
  return `${size} ${sizes[i]}`;
}
function sendErrorReport(message, context = "", extra = {}) {
  try {
    const body = {
      message: String(message),
      context: String(context),
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...extra
      }
    };
    fetch("/api/logs/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(() => {
    });
  } catch (_e) {
  }
}

// src/config/constants.js
var RATE_LIMIT = {
  MAX_MESSAGES_PER_MINUTE: 30,
  MAX_CONNECTIONS_PER_IP: 25,
  MESSAGE_COOLDOWN: 1e3
  // 1 second between messages
};
var SECURITY = {
  MAX_MESSAGE_LENGTH: 7500,
  ALLOWED_ORIGINS: [
    "https://kalpha.mmv.kr",
    "http://localhost:8787",
    "http://127.0.0.1:8787"
  ]
};
var CHANNEL = {
  EMPTY_TTL: 10 * 60 * 1e3,
  // 10 minutes
  MAX_NAME_LENGTH: 20
};
var MESSAGE_RETENTION_MS = 12 * 60 * 60 * 1e3;
var MESSAGE_EDIT_WINDOW_MS = 10 * 60 * 1e3;
var SESSION_TIMEOUT_MS = 30 * 60 * 1e3;
var MAX_NICKNAME_LENGTH = 12;
var AUTH = {
  RATE_LIMIT_EXPIRE: 5 * 60 * 1e3,
  // 5 minutes
  MAX_FAILED_ATTEMPTS: 5,
  KV_TTL_SECONDS: 10 * 60,
  TOKEN_EXPIRY_MS: 2 * 60 * 60 * 1e3
  // 2 hours
};
var PUSH_SUBSCRIPTION_TTL = 30 * 24 * 60 * 60;
var UPLOAD = {
  MAX_BYTES: 250 * 1024 * 1024,
  // 250MB (file.kalpha.kr limit)
  MAX_BODY_BYTES: 1024 * 1024,
  // 1MB
  MAX_FILENAME_LENGTH: 255,
  MAX_FILETYPE_LENGTH: 100,
  RATE_LIMIT: { windowMs: 6e4, max: 10 },
  WORKER_BODY_LIMIT: 100 * 1024 * 1024,
  // Worker 수신 한계
  CHUNK_SIZE: 10 * 1024 * 1024,
  // 기본 청크 10MB
  CHUNK_CONCURRENCY: 3
  // 동시 전송 청크 수
};
var DEAD_DROP = {
  TTL_MS: 30 * 60 * 1e3,
  // 30 minutes
  MAX_MESSAGE_LENGTH: 1e4
};
var ONE_HOUR_MS = 60 * 60 * 1e3;
var ONE_DAY_MS = 24 * 60 * 60 * 1e3;
var WS_RECONNECT = {
  MAX_ATTEMPTS: 10,
  BASE_DELAY_MS: 1e3,
  MAX_DELAY_MS: 3e4,
  HEARTBEAT_VISIBLE: 25e3,
  HEARTBEAT_HIDDEN: 6e4,
  HEARTBEAT_TIMEOUT_VISIBLE: 1e4,
  HEARTBEAT_TIMEOUT_HIDDEN: 3e4
};
var FILE_UPLOAD_CLIENT = {
  MAX_FILES: 10,
  CONCURRENT_UPLOADS: 3,
  MAX_BYTES: 250 * 1024 * 1024
  // 250MB
};
var SEARCH_CLIENT = {
  DEBOUNCE_MS: 300,
  RESULT_PREVIEW_LENGTH: 200,
  MAX_RESULTS: 100
};
var TURNSTILE_CLIENT = {
  SESSION_AGE_MS: 4 * 60 * 60 * 1e3,
  // 4 hours
  HIDE_DELAY_MS: 800,
  POLL_MAX_ATTEMPTS: 50,
  POLL_INTERVAL_MS: 100
};
var OG_PREVIEW_CLIENT = {
  CACHE_SIZE: 50,
  FETCH_TIMEOUT_MS: 5e3,
  RATE_LIMIT_DELAY_MS: 150,
  TRUNCATION_LENGTH: 200,
  ID_PREFIX_LENGTH: 80
};
var UI = {
  SCROLL_PROXIMITY_PX: 150,
  MESSAGE_GROUP_TIME_MS: 5 * 60 * 1e3,
  // 5 minutes
  REPLY_PREVIEW_LENGTH: 50,
  LONG_PRESS_MS: 500,
  ERROR_BANNER_TIMEOUT_MS: 4e3,
  SYSTEM_MESSAGE_TIMEOUT_MS: 3500,
  TOAST_DURATION_MS: 3e3,
  TOAST_FADE_MS: 500,
  HIGHLIGHT_RING_MS: 2e3,
  TYPING_EXPIRY_MS: 5e3,
  TYPING_INACTIVITY_MS: 2e3,
  TITLE_BLINK_MS: 1e3,
  CONTEXT_MENU_DELAY_MS: 100,
  MODAL_FOCUS_DELAY_MS: 100
};

// public/js/session.js?v=1.0.4
var SessionManager = class {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.nickname = this.getOrCreateNickname();
  }
  getOrCreateSessionId() {
    let sessionId = localStorage.getItem("chatSessionId");
    if (!sessionId) {
      sessionId = this.generateSessionId();
      localStorage.setItem("chatSessionId", sessionId);
    }
    return sessionId;
  }
  generateSessionId() {
    return "user_" + crypto.randomUUID().replace(/-/g, "").substring(0, 16) + "_" + Date.now();
  }
  getSessionId() {
    return this.sessionId;
  }
  getOrCreateNickname() {
    let nickname = localStorage.getItem("chatNickname");
    if (!nickname) {
      nickname = "\uC775\uBA85";
      localStorage.setItem("chatNickname", nickname);
    }
    return nickname;
  }
  getNickname() {
    return this.nickname;
  }
  setNickname(name) {
    const safeName = name ? name.trim().substring(0, MAX_NICKNAME_LENGTH) : "\uC775\uBA85";
    this.nickname = safeName || "\uC775\uBA85";
    localStorage.setItem("chatNickname", this.nickname);
    return this.nickname;
  }
  hasAcceptedNicknameNotice() {
    return localStorage.getItem("chatNicknameNoticeAccepted") === "true";
  }
  setNicknameNoticeAccepted(accepted = true) {
    if (accepted) {
      localStorage.setItem("chatNicknameNoticeAccepted", "true");
    } else {
      localStorage.removeItem("chatNicknameNoticeAccepted");
    }
  }
};

// public/js/websocket.js?v=1.0.3
var WebSocketManager = class {
  constructor(sessionId, messageHandler) {
    this.ws = null;
    this.sessionId = sessionId;
    this.messageHandler = messageHandler;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = WS_RECONNECT.MAX_ATTEMPTS;
    this.baseReconnectDelay = WS_RECONNECT.BASE_DELAY_MS;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.isReconnecting = false;
    this.hasConnectedBefore = false;
    this.manualClose = false;
    this.channelId = "0";
    this.visibleHeartbeatInterval = WS_RECONNECT.HEARTBEAT_VISIBLE;
    this.visibleHeartbeatTimeout = WS_RECONNECT.HEARTBEAT_TIMEOUT_VISIBLE;
    this.hiddenHeartbeatInterval = WS_RECONNECT.HEARTBEAT_HIDDEN;
    this.hiddenHeartbeatTimeout = WS_RECONNECT.HEARTBEAT_TIMEOUT_HIDDEN;
  }
  async connect() {
    try {
      const banCheckResponse = await fetch(`/api/check-ban?sessionId=${encodeURIComponent(this.sessionId)}`);
      const banStatus = await banCheckResponse.json();
      if (banStatus.banned) {
        this.messageHandler.onError(`\uC811\uC18D\uC774 \uCC28\uB2E8\uB418\uC5C8\uC2B5\uB2C8\uB2E4. ${banStatus.remainingSeconds}\uCD08 \uD6C4\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.`);
        this.messageHandler.onConnectionChange("banned");
        return;
      }
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${encodeURIComponent(this.sessionId)}`;
      if (this.channelId && this.channelId !== "0") {
        wsUrl += `&channel=${encodeURIComponent(this.channelId)}`;
      }
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onclose = (event) => this.handleClose(event);
      this.ws.onerror = (error) => this.handleError(error);
    } catch (error) {
      console.error("Connection error:", error);
      this.scheduleReconnect();
    }
  }
  handleOpen() {
    this.reconnectAttempts = 0;
    this.send({
      type: "join",
      sessionId: this.sessionId,
      timestamp: Date.now(),
      isReconnect: this.hasConnectedBefore
    });
    this.hasConnectedBefore = true;
    this.isReconnecting = false;
    this.messageHandler.onConnectionChange("connected");
    if (typeof document !== "undefined" && document.hidden) {
      this.startHeartbeat(this.hiddenHeartbeatInterval, this.hiddenHeartbeatTimeout);
    } else {
      this.startHeartbeat(this.visibleHeartbeatInterval, this.visibleHeartbeatTimeout);
    }
  }
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "pong") {
        this.handlePong();
        return;
      }
      this.messageHandler.onMessage(data);
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  }
  handleClose(event) {
    this.stopHeartbeat();
    this.messageHandler.onConnectionChange("disconnected");
    const isAdminKick = event.code === 1008;
    if (!this.manualClose && !isAdminKick) {
      this.isReconnecting = true;
      this.scheduleReconnect();
    }
    this.manualClose = false;
  }
  handleError(error) {
    console.error("WebSocket error:", error);
    this.messageHandler.onConnectionChange("error");
  }
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.messageHandler.onError("\uC7AC\uC5F0\uACB0 \uC2E4\uD328. \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD574\uC8FC\uC138\uC694.");
      return;
    }
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      WS_RECONNECT.MAX_DELAY_MS
    );
    this.reconnectAttempts++;
    this.messageHandler.onConnectionChange("reconnecting", this.reconnectAttempts, this.maxReconnectAttempts);
    setTimeout(() => {
      this.connect();
    }, delay);
  }
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
  checkConnection() {
    if (!this.isConnected() && !this.isReconnecting) {
      this.connect();
    } else if (this.isConnected()) {
      this.send({ type: "ping", timestamp: Date.now() });
    }
  }
  startHeartbeat(intervalDelay = this.visibleHeartbeatInterval, timeoutDelay = this.visibleHeartbeatTimeout) {
    this.stopHeartbeat();
    this.currentHeartbeatIntervalDelay = intervalDelay;
    this.currentHeartbeatTimeoutDelay = timeoutDelay;
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: "ping", timestamp: Date.now() });
        this.heartbeatTimeout = setTimeout(() => {
          console.warn("Heartbeat timeout - connection may be lost");
          if (this.ws) {
            this.ws.close();
          }
        }, timeoutDelay);
      } else if (!this.isReconnecting) {
        this.connect();
      }
    }, intervalDelay);
    if (typeof document !== "undefined" && !this._visibilityHandlerAttached) {
      document.addEventListener("visibilitychange", () => this.handleVisibilityChange());
      this._visibilityHandlerAttached = true;
    }
  }
  handleVisibilityChange() {
    if (typeof document === "undefined") return;
    if (document.hidden) {
      this.startHeartbeat(this.hiddenHeartbeatInterval, this.hiddenHeartbeatTimeout);
    } else {
      this.startHeartbeat(this.visibleHeartbeatInterval, this.visibleHeartbeatTimeout);
      if (this.isConnected()) {
        this.send({ type: "ping", timestamp: Date.now() });
      } else if (!this.isReconnecting) {
        this.connect();
      }
    }
  }
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }
  handlePong() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }
  disconnect() {
    this.manualClose = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }
};

// public/js/code-highlight.js
var LANG_ALIASES = {
  "js": "javascript",
  "ts": "typescript",
  "py": "python",
  "rb": "ruby",
  "cs": "csharp",
  "c#": "csharp",
  "c++": "cpp",
  "md": "markdown",
  "sh": "bash",
  "shell": "bash",
  "yml": "yaml",
  "html": "markup",
  "xml": "markup",
  "svg": "markup",
  "vue": "markup",
  "tex": "latex"
};
function resolveLangAlias(lang) {
  if (!lang) return "";
  const lower = lang.toLowerCase();
  return LANG_ALIASES[lower] || lower;
}
function getDisplayLang(inputLang, resolvedLang) {
  return inputLang || resolvedLang || "";
}
function detectLanguage(content) {
  const trimmed = content.trim();
  if (/^#include\s*[<"]/m.test(trimmed)) return "cpp";
  if (/^#!\/bin\/(bash|sh|zsh)/m.test(trimmed)) return "bash";
  if (/^(export\s+\w+=|alias\s+\w+=|source\s+|chmod\s+|echo\s+["'])/m.test(trimmed) && !/;\s*$/.test(trimmed.split("\n")[0])) return "bash";
  if (/^\s*[{[]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch (_e) {
    }
  }
  if (/^\s*<(!DOCTYPE|html|head|body|div|span|script|style|link|meta|p\s|p>|a\s|ul|ol|li|table|form|input|img|section|header|footer|nav|main)/mi.test(trimmed)) return "markup";
  if (/^(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW|DATABASE)|ALTER\s+TABLE|DROP\s+TABLE)\s/mi.test(trimmed)) return "sql";
  if (/^(fn\s+\w+|let\s+mut\s|use\s+std::|impl\s+\w+|pub\s+fn\s)/m.test(trimmed)) return "rust";
  if (/^package\s+\w+/m.test(trimmed) && /^(func\s|import\s)/m.test(trimmed)) return "go";
  if (/^using\s+System/m.test(trimmed)) return "csharp";
  if (/^namespace\s+[\w.]+\s*\{/m.test(trimmed)) return "csharp";
  if (/^(public\s+class\s+\w+|package\s+[\w.]+\s*;|import\s+java\.)/m.test(trimmed)) return "java";
  if (/^(def\s+\w+\s*\(|class\s+\w+.*:\s*$|from\s+\w+\s+import\s|if\s+__name__\s*==|print\s*\(|elif\s|except\s)/m.test(trimmed)) return "python";
  if (/^(\.[a-zA-Z_][\w-]*|#[a-zA-Z_][\w-]*|@media\s|@keyframes\s|@import\s|:root\s*\{|body\s*\{|html\s*\{|\*\s*\{)/m.test(trimmed) && /\{[\s\S]*\}/.test(trimmed)) return "css";
  if (/^(interface\s+\w+\s*\{|type\s+\w+\s*=|enum\s+\w+\s*\{)/m.test(trimmed)) return "typescript";
  if (/:\s*(string|number|boolean|void|any|never|Promise<)/m.test(trimmed) && /^(const|let|var|function|class|export|import)\s/m.test(trimmed)) return "typescript";
  if (/^(const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|function\s+\w+|class\s+\w+\s*\{|import\s+.*\s+from\s|export\s+(default\s+)?)/m.test(trimmed)) return "javascript";
  if (/^#{1,6}\s/m.test(trimmed) && /(\*\*|__|\[.*\]\(.*\)|^-\s|^\d+\.\s)/m.test(trimmed)) return "markdown";
  return "";
}
function renderCodeBlock(code, lang, sanitizeFn) {
  const trimmedCode = code.replace(/^\n+|\n+$/g, "");
  let resolvedLang = resolveLangAlias(lang);
  if (!resolvedLang) {
    resolvedLang = detectLanguage(trimmedCode);
  }
  const displayLang = getDisplayLang(lang, resolvedLang);
  const langLabel = displayLang ? `<span class="code-block-lang">${sanitizeFn(displayLang)}</span>` : "";
  const copyBtnId = "copy_" + Math.random().toString(36).substring(2, 9);
  const codeId = "code_" + Math.random().toString(36).substring(2, 9);
  const safeCode = sanitizeFn(trimmedCode);
  const langClass = resolvedLang ? `language-${sanitizeFn(resolvedLang)}` : "";
  const codeHtml = `<div class="code-block-wrapper">
        <div class="code-block-header">
            ${langLabel}
            <button id="${copyBtnId}" class="code-copy-btn" title="\uCF54\uB4DC \uBCF5\uC0AC">\uBCF5\uC0AC</button>
        </div>
        <pre class="code-block"><code id="${codeId}" class="${langClass}">${safeCode}</code></pre>
    </div>`;
  setTimeout(() => {
    const codeEl = document.getElementById(codeId);
    if (codeEl && typeof Prism !== "undefined" && resolvedLang) {
      try {
        Prism.highlightElement(codeEl);
      } catch (_e) {
      }
    }
    const btn = document.getElementById(copyBtnId);
    if (btn) {
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(trimmedCode).then(() => {
          btn.textContent = "\uBCF5\uC0AC\uB428!";
          setTimeout(() => {
            btn.textContent = "\uBCF5\uC0AC";
          }, 2e3);
        }).catch(() => {
          btn.textContent = "\uC2E4\uD328";
          setTimeout(() => {
            btn.textContent = "\uBCF5\uC0AC";
          }, 2e3);
        });
      });
    }
  }, 0);
  return codeHtml;
}
function isLikelyCode(content) {
  if (!content || typeof content !== "string") return false;
  const trimmed = content.trim();
  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 2) return false;
  if (lines.length > 50) return true;
  let score = 0;
  const startPatterns = /^(#!\/bin\/|import\s|from\s|export\s|const\s|let\s|var\s|function[\s(]|class\s|def\s|return\s|if\s*\(|else\s*\{|for\s*\(|while\s*\(|switch\s*\(|try\s*\{|catch\s*\(|#include|#define|#import|using\s|namespace\s|public\s|private\s|protected\s|static\s|void\s|int\s|string\s|bool\s|package\s|interface\s|struct\s|enum\s|<!DOCTYPE|<html|<head|<body|<div|<script|<style|<link|<meta|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|CREATE\s|ALTER\s|DROP\s)/mi;
  if (startPatterns.test(trimmed)) score += 3;
  let codeEndingLines = 0;
  for (const line of lines) {
    const t = line.trim();
    if (/[;{})\]]=?>?\s*$/.test(t) && t.length > 1) codeEndingLines++;
  }
  const endingRatio = codeEndingLines / lines.length;
  if (endingRatio > 0.4) score += 3;
  else if (endingRatio > 0.2) score += 1;
  let indentedLines = 0;
  for (const line of lines) {
    if (/^(\t|  {2,})/.test(line) && line.trim().length > 0) indentedLines++;
  }
  if (indentedLines / lines.length > 0.3) score += 2;
  const codeChars = (trimmed.match(/[{}();=<>]/g) || []).length;
  const charDensity = codeChars / trimmed.length;
  if (charDensity > 0.08) score += 2;
  else if (charDensity > 0.04) score += 1;
  if (/\/\/.*|\/\*[\s\S]*?\*\/|^\s*#.*$/m.test(trimmed)) score += 1;
  if (/(["'])(?:(?=(\\?))\2.)*?\1/.test(trimmed) && /[;{}()=]/.test(trimmed)) score += 1;
  let htmlLines = 0;
  for (const line of lines) {
    if (/^\s*<\/?[a-zA-Z]/.test(line)) htmlLines++;
  }
  if (htmlLines / lines.length > 0.3) score += 3;
  if (detectLanguage(trimmed)) score += 3;
  return score >= 5;
}
var CODE_BLOCK_PREFIX = "\u200B\u200BCODEBLOCK";
var INLINE_CODE_PREFIX = "\u200B\u200BINLINECODE";
var PLACEHOLDER_SUFFIX = "\u200B\u200B";

// public/js/ui-render.js
var rendering = {
  isValidUrl(url) {
    return isValidUrl(url);
  },
  sanitizeUrl(url) {
    return sanitizeUrl(url);
  },
  decodeHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent;
  },
  formatFileSize(bytes) {
    return formatFileSize(bytes);
  },
  htmlToPlainText(html) {
    const text = html.replace(/<br\s*\/?>/gi, "\n");
    const div = document.createElement("div");
    div.innerHTML = text;
    return div.textContent || div.innerText || "";
  },
  _getThemeHueRange() {
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    const ranges = {
      dark: { min: 0, max: 360, sat: 25, lgt: 28, alpha: 0.8 },
      light: { min: 0, max: 360, sat: 30, lgt: 75, alpha: 0.85 },
      midnight: { min: 210, max: 270, sat: 20, lgt: 25, alpha: 0.8 },
      ocean: { min: 160, max: 210, sat: 25, lgt: 30, alpha: 0.8 },
      forest: { min: 80, max: 160, sat: 25, lgt: 30, alpha: 0.8 },
      amethyst: { min: 240, max: 320, sat: 25, lgt: 28, alpha: 0.8 },
      sunset: { min: 0, max: 50, sat: 35, lgt: 30, alpha: 0.8 },
      sakura: { min: 310, max: 360, sat: 25, lgt: 35, alpha: 0.8 }
    };
    return ranges[theme] || ranges.dark;
  },
  _getSenderHue(sessionId) {
    if (!sessionId) return { hue: 220, sat: 25, lgt: 28, alpha: 0.8 };
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      hash = (hash << 5) - hash + sessionId.charCodeAt(i);
      hash |= 0;
    }
    const range = this._getThemeHueRange();
    const span = range.max - range.min;
    const hue = range.min + Math.abs(hash) % Math.max(span, 1);
    return { hue, sat: range.sat, lgt: range.lgt, alpha: range.alpha };
  },
  addMessageInteractions(messageDiv) {
    messageDiv.style.cursor = "pointer";
    messageDiv.style.userSelect = "text";
  },
  highlightMessage(messageId) {
    const targetDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (!targetDiv) {
      alert("\uD574\uB2F9 \uBA54\uC2DC\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. (\uC624\uB798\uB41C \uBA54\uC2DC\uC9C0\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4)");
      return;
    }
    targetDiv.scrollIntoView({ behavior: "smooth", block: "center" });
    targetDiv.classList.add("ring-2", "ring-yellow-400", "transition-all");
    setTimeout(() => {
      targetDiv.classList.remove("ring-2", "ring-yellow-400", "transition-all");
    }, 2e3);
  },
  displayMessage(data, isOwnMessage, sessionId) {
    if (data.messageId && this.messagesContainer.querySelector(`[data-message-id="${data.messageId}"]`)) {
      return;
    }
    const messageDiv = this._renderSingleMessage(data, sessionId);
    this.messagesContainer.appendChild(messageDiv);
  },
  displayBatchMessages(messages, sessionId) {
    if (!messages || messages.length === 0) return;
    const fragment = document.createDocumentFragment();
    for (const data of messages) {
      if (data.messageId && this.messagesContainer.querySelector(`[data-message-id="${data.messageId}"]`)) {
        continue;
      }
      const messageDiv = this._renderSingleMessage(data, sessionId);
      fragment.appendChild(messageDiv);
    }
    this.messagesContainer.appendChild(fragment);
    const container = this.messagesContainer;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < UI.SCROLL_PROXIMITY_PX;
    if (isAtBottom) {
      this.scrollToBottom();
    } else {
      this.scrollButton.classList.remove("opacity-0", "pointer-events-none");
      this.scrollButton.classList.add("opacity-100", "pointer-events-auto");
    }
  },
  _renderSingleMessage(data, sessionId) {
    if (data.type === "summary") {
      const MODE_STYLES = {
        default: { bg: "bg-indigo-900/40", border: "border-indigo-700/50", title: "text-indigo-300", label: "AI \uB300\uD654 \uC694\uC57D" },
        topic: { bg: "bg-emerald-900/40", border: "border-emerald-700/50", title: "text-emerald-300", label: "\uB300\uD654 \uC8FC\uC81C" },
        mood: { bg: "bg-amber-900/40", border: "border-amber-700/50", title: "text-amber-300", label: "\uB300\uD654 \uBD84\uC704\uAE30" },
        conflict: { bg: "bg-red-900/40", border: "border-red-700/50", title: "text-red-300", label: "\uC758\uACAC \uCDA9\uB3CC" }
      };
      const s = MODE_STYLES[data.summaryMode] || MODE_STYLES.default;
      const wrapper2 = document.createElement("div");
      wrapper2.className = `${s.bg} ${s.border} border rounded-lg p-3 mx-2 my-3`;
      wrapper2.setAttribute("data-message", "true");
      wrapper2.setAttribute("data-message-id", data.messageId);
      const title = document.createElement("div");
      title.className = `text-xs font-semibold mb-2 ${s.title}`;
      title.textContent = s.label;
      const content = document.createElement("div");
      content.className = "text-sm text-gray-200 leading-relaxed";
      content.textContent = data.content;
      wrapper2.appendChild(title);
      wrapper2.appendChild(content);
      return wrapper2;
    }
    const isOwnMessage = data.sessionId === sessionId;
    const isAdmin = !!(data.sessionId && String(data.sessionId).startsWith("admin_"));
    const TIME_GAP = UI.MESSAGE_GROUP_TIME_MS;
    const sameAsPrev = this._lastSender !== null && this._lastSender === data.sessionId && this._lastTime !== null && data.timestamp - this._lastTime < TIME_GAP;
    const isGrouped = sameAsPrev && !isAdmin;
    if (isGrouped && this._lastMessageEl) {
      this._lastMessageEl.classList.add("msg-bubble-grouped");
    }
    this._lastSender = data.sessionId;
    this._lastTime = data.timestamp;
    const timestamp = new Date(data.timestamp).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit"
    });
    const canEdit = isOwnMessage && data.timestamp && Date.now() - data.timestamp < MESSAGE_EDIT_WINDOW_MS;
    const senderName = data.nickname || "\uC775\uBA85";
    let contentHtml = "";
    if (data.replyTo) {
      const replyContent = data.replyTo.content || "[\uD30C\uC77C]";
      const truncatedReply = replyContent.length > 50 ? replyContent.substring(0, UI.REPLY_PREVIEW_LENGTH) + "..." : replyContent;
      const replyLabel = data.replyTo.isOwnMessage ? "\uB0B4 \uBA54\uC2DC\uC9C0" : "\uC775\uBA85";
      contentHtml += `
                <div class="reply-reference cursor-pointer hover:bg-gray-700/50 transition-colors bg-gray-800/50 border-l-2 border-gray-500 pl-2 py-1 mb-2 text-xs"
                     data-reply-to-id="${escapeHtml(data.replyTo.messageId || "")}">
                    <div class="text-gray-400">${replyLabel}\uC5D0\uAC8C \uB2F5\uC7A5:</div>
                    <div class="text-gray-300 italic">${escapeHtml(truncatedReply)}</div>
                </div>
            `;
    }
    if (data.content && data.content.trim()) {
      if (data.replyTo && data.replyTo.isSecret && data.replyTo.secretId) {
        const isRecipient = data.replyTo.targetSessionId === sessionId;
        if (isRecipient) {
          contentHtml += `
                        <div class="secret-message-container bg-gray-800/60 border border-gray-600/50 rounded-lg p-3 mt-2">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-gray-300 text-sm">\uBE44\uBC00 \uBA54\uC2DC\uC9C0</span>
                            </div>
                            <button class="reveal-secret-btn w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded transition-colors text-sm font-medium"
                                    data-secret-id="${escapeHtml(data.replyTo.secretId)}">
                                \uBE44\uBC00 \uBA54\uC2DC\uC9C0 \uC77D\uAE30 (\uD55C \uBC88\uB9CC \uBCFC \uC218 \uC788\uC74C)
                            </button>
                            <div class="secret-message-content hidden mt-3 p-3 bg-gray-800/50 rounded text-sm break-words"></div>
                        </div>
                    `;
        } else if (isOwnMessage) {
          contentHtml += '<div class="text-sm text-gray-400 italic">\uBE44\uBC00 \uBA54\uC2DC\uC9C0\uB97C \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4</div>';
        } else {
          contentHtml += '<div class="text-sm text-gray-500 italic">\uBE44\uBC00 \uBA54\uC2DC\uC9C0 (\uB2F5\uC7A5)</div>';
        }
      } else {
        contentHtml += `<div class="text-sm break-words leading-relaxed message-content">${this.formatMessageContent(data.content)}</div>`;
      }
    }
    if (data.files && Array.isArray(data.files) && data.files.length > 0) {
      contentHtml += this.formatFileGallery(data.files);
    } else if (data.file && data.file.url) {
      contentHtml += this.formatFileContent(data.file);
    }
    if (!contentHtml) {
      contentHtml = '<div class="text-sm text-gray-500 italic">\uB0B4\uC6A9 \uC5C6\uC74C</div>';
    }
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-message", "true");
    wrapper.setAttribute("data-message-id", data.messageId);
    wrapper.setAttribute("data-session-id", data.sessionId);
    wrapper.setAttribute("data-timestamp", data.timestamp);
    wrapper.setAttribute("data-can-edit", canEdit ? "true" : "false");
    if (data.replyTo?.messageId) {
      wrapper.setAttribute("data-reply-to", data.replyTo.messageId);
    }
    if (isAdmin) {
      wrapper.className = "flex flex-col";
      wrapper.classList.add(isOwnMessage ? "items-end" : "items-start");
      if (isOwnMessage) wrapper.style.marginLeft = "auto";
      if (!isGrouped) {
        const adminLabel = document.createElement("div");
        adminLabel.className = "msg-sender-label px-1 text-yellow-300 font-semibold";
        adminLabel.textContent = "\uAD00\uB9AC\uC790";
        wrapper.appendChild(adminLabel);
      }
    } else if (!isGrouped) {
      wrapper.className = "flex flex-col";
      wrapper.classList.add(isOwnMessage ? "items-end" : "items-start");
      if (isOwnMessage) wrapper.style.marginLeft = "auto";
      const nameLabel = document.createElement("div");
      const senderColor = isOwnMessage ? null : this._getSenderHue(data.sessionId);
      nameLabel.className = "msg-sender-label px-1";
      if (senderColor) {
        wrapper.style.setProperty("--sender-hue", senderColor.hue);
      } else {
        nameLabel.style.setProperty("color", "var(--c-blue-300)");
      }
      nameLabel.textContent = isOwnMessage ? `\uB098 (${senderName})` : senderName;
      wrapper.appendChild(nameLabel);
    } else {
      wrapper.className = "flex flex-col";
      if (isOwnMessage) {
        wrapper.classList.add("items-end");
        wrapper.style.marginLeft = "auto";
      }
    }
    const bubble = document.createElement("div");
    if (isAdmin) {
      bubble.className = "message-enter msg-bubble msg-bubble-admin border-yellow-400 ring-1 ring-yellow-400/20";
      bubble.style.setProperty("--bubble-bg", "rgba(113,63,18,0.25)");
      bubble.style.backgroundColor = "rgba(113,63,18,0.25)";
      bubble.setAttribute("role", "region");
      bubble.setAttribute("aria-live", "polite");
      bubble.setAttribute("aria-label", "\uAD00\uB9AC\uC790 \uBA54\uC2DC\uC9C0");
    } else if (isOwnMessage) {
      bubble.className = "message-enter-own msg-bubble msg-bubble-own";
    } else {
      const senderColor = this._getSenderHue(data.sessionId);
      bubble.className = "message-enter-other msg-bubble msg-bubble-other";
      bubble.style.setProperty("--sender-hue", senderColor.hue);
    }
    if (isGrouped) {
      bubble.classList.add("msg-bubble-grouped");
    }
    const editedLabel = data.editedAt ? ' <span class="text-xs opacity-60">(\uC218\uC815\uB428)</span>' : "";
    bubble.innerHTML = `
            ${contentHtml}
            <div class="msg-time">${timestamp}${editedLabel}</div>
        `;
    wrapper.appendChild(bubble);
    if (data.reactions && Object.keys(data.reactions).length > 0) {
      const reactionBar = document.createElement("div");
      reactionBar.className = "reaction-bar flex flex-wrap gap-1 mt-1";
      for (const [emoji, count] of Object.entries(data.reactions)) {
        if (count > 0) {
          const userReacted = data.reactionSessions && data.reactionSessions[emoji] && data.reactionSessions[emoji].includes(sessionId);
          const pill = document.createElement("button");
          pill.className = "reaction-pill inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs " + (userReacted ? "bg-blue-600 text-white ring-1 ring-blue-400" : "bg-gray-600 text-gray-200 hover:bg-gray-500");
          pill.setAttribute("data-emoji", emoji);
          pill.setAttribute("data-message-id", data.messageId);
          pill.innerHTML = `${emoji} ${count}`;
          reactionBar.appendChild(pill);
        }
      }
      wrapper.appendChild(reactionBar);
    }
    this.addMessageInteractions(wrapper, data.messageId, canEdit, data.replyTo?.messageId);
    this._lastMessageEl = bubble;
    return wrapper;
  },
  formatMessageContent(content) {
    if (!content) return "";
    if (!/```/.test(content) && isLikelyCode(content)) {
      return renderCodeBlock(content, "", (text) => escapeHtml(text));
    }
    let processed = content;
    const codeBlocks = [];
    const inlineCodes = [];
    const urlPlaceholders = [];
    const mdLinkPlaceholders = [];
    processed = processed.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `${CODE_BLOCK_PREFIX}${codeBlocks.length}${PLACEHOLDER_SUFFIX}`;
      codeBlocks.push({ lang: lang.toLowerCase(), code });
      return placeholder;
    });
    processed = processed.replace(/`([^`\n]+)`/g, (match, code) => {
      const placeholder = `${INLINE_CODE_PREFIX}${inlineCodes.length}${PLACEHOLDER_SUFFIX}`;
      inlineCodes.push(code);
      return placeholder;
    });
    const sanitized = escapeHtml(processed);
    let step1 = sanitized;
    const urlPattern = /(https?:\/\/[^\s<">]+[^\s<".,;)])|(\bwww\.[^\s<">]+[^\s<".,;)])|(\b[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(?::[0-9]+)?(?:\/[^\s<"]*[^\s<".,;)])?)/gi;
    step1 = step1.replace(urlPattern, (match) => {
      const url = this.decodeHtml(match);
      if (!this.isValidUrl(url)) {
        return match;
      }
      const safeUrl = this.sanitizeUrl(url);
      const placeholder = `{{UP${urlPlaceholders.length}}}`;
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
      let html;
      if (imageExtensions.test(url)) {
        const imgId = "img_" + Math.random().toString(36).substring(2, 9);
        setTimeout(() => {
          const img = document.getElementById(imgId);
          if (img) {
            img.addEventListener("error", function() {
              this.style.display = "none";
            });
          }
        }, 0);
        html = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline block">${match}</a>
                <img id="${imgId}" src="${safeUrl}" alt="Image preview" class="mt-2 max-w-full max-h-64 rounded-lg border border-gray-600 object-contain" loading="lazy">`;
      } else if (/^https?:\/\//i.test(url)) {
        const secBtnId = "secbtn_" + Math.random().toString(36).substring(2, 9);
        setTimeout(() => {
          const btnEl = document.getElementById(secBtnId);
          if (btnEl) {
            btnEl.addEventListener("click", function(e) {
              e.preventDefault();
              e.stopPropagation();
              if (window.chatClient && window.chatClient.securityHeaders) {
                const urlData = this.getAttribute("data-sec-url");
                window.chatClient.securityHeaders.analyze(urlData);
              }
            });
            btnEl.title = "\uBCF4\uC548 \uD5E4\uB354 \uBD84\uC11D";
          }
        }, 0);
        html = `<span class="inline-flex items-center gap-1"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${match}</a><button id="${secBtnId}" data-sec-url="${safeUrl}" class="inline-flex items-center justify-center w-4 h-4 text-gray-500 hover:text-emerald-400 transition-colors flex-shrink-0" aria-label="\uBCF4\uC548 \uD5E4\uB354 \uBD84\uC11D"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-2.332 9-7.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></button><span class="text-[10px] text-emerald-400/70 whitespace-nowrap">\u2190 \uBCF4\uC548 \uD5E4\uB354\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.</span></span>`;
      } else {
        html = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${match}</a>`;
      }
      urlPlaceholders.push(html);
      return placeholder;
    });
    let step2 = step1;
    step2 = step2.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, text, url) => {
      const placeholder = `{{ML${mdLinkPlaceholders.length}}}`;
      mdLinkPlaceholders.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${text}</a>`);
      return placeholder;
    });
    let formatted = step2;
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
    formatted = formatted.replace(/__(.+?)__/g, '<strong class="font-bold text-white">$1</strong>');
    formatted = formatted.replace(/\*(.+?)\*/g, '<em class="italic text-gray-200">$1</em>');
    formatted = formatted.replace(/_(.+?)_/g, '<em class="italic text-gray-200">$1</em>');
    formatted = formatted.replace(/~~(.+?)~~/g, '<del class="line-through text-gray-500">$1</del>');
    formatted = formatted.replace(/(^|<br>)&gt;\s?([^<]+)/g, '$1<span class="block border-l-2 border-gray-500 pl-2 my-1 text-gray-300 italic">$2</span>');
    for (let i = 0; i < mdLinkPlaceholders.length; i++) {
      formatted = formatted.replace(`{{ML${i}}}`, mdLinkPlaceholders[i]);
    }
    for (let i = 0; i < urlPlaceholders.length; i++) {
      formatted = formatted.replace(`{{UP${i}}}`, urlPlaceholders[i]);
    }
    for (let i = 0; i < codeBlocks.length; i++) {
      const { lang, code } = codeBlocks[i];
      formatted = formatted.replace(`${CODE_BLOCK_PREFIX}${i}${PLACEHOLDER_SUFFIX}`, renderCodeBlock(code, lang, (text) => escapeHtml(text)));
    }
    for (let i = 0; i < inlineCodes.length; i++) {
      const code = inlineCodes[i];
      const safeCode = escapeHtml(code);
      formatted = formatted.replace(`${INLINE_CODE_PREFIX}${i}${PLACEHOLDER_SUFFIX}`, `<code class="inline-code">${safeCode}</code>`);
    }
    return formatted.replace(/\n/g, "<br>");
  },
  formatFileContent(file) {
    if (!file || !file.url) return "";
    if (!this.isValidUrl(file.url)) {
      return '<div class="text-red-400 text-sm">Invalid file URL</div>';
    }
    const fileType = file.filetype || "";
    const fileName = escapeHtml(file.filename || "file");
    const fileSize = this.formatFileSize(file.filesize || 0);
    const safeUrl = this.sanitizeUrl(file.url);
    if (fileType.startsWith("image/")) {
      const imgId = "file_img_" + Math.random().toString(36).substring(2, 9);
      setTimeout(() => {
        const img = document.getElementById(imgId);
        if (img) {
          img.addEventListener("error", function() {
            this.style.display = "none";
          });
          img.addEventListener("click", () => {
            this.ensureLightboxExists();
            this.openLightbox([{ url: file.url, filename: file.filename }], 0);
          });
        }
      }, 0);
      return `
                <div class="mt-2">
                    <img id="${imgId}" src="${safeUrl}" alt="${fileName}" 
                         class="max-w-full max-h-96 rounded-lg border border-gray-600 object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                         loading="lazy">
                    <div class="mt-1 text-xs text-gray-400">
                        <span>${fileName}</span> \xB7 <span>${fileSize}</span>
                    </div>
                </div>
            `;
    }
    if (fileType.startsWith("video/")) {
      return `
                <div class="mt-2">
                    <video controls class="max-w-full max-h-96 rounded-lg border border-gray-600">
                        <source src="${safeUrl}" type="${escapeHtml(fileType)}">
                        Your browser does not support the video tag.
                    </video>
                    <div class="mt-1 text-xs text-gray-400">
                        <span>${fileName}</span> \xB7 <span>${fileSize}</span>
                    </div>
                </div>
            `;
    }
    if (fileType.startsWith("audio/")) {
      return `
                <div class="mt-2">
                    <audio controls class="w-full max-w-md">
                        <source src="${safeUrl}" type="${escapeHtml(fileType)}">
                        Your browser does not support the audio tag.
                    </audio>
                    <div class="mt-1 text-xs text-gray-400">
                        <span>${fileName}</span> \xB7 <span>${fileSize}</span>
                    </div>
                </div>
            `;
    }
    return `
            <div class="mt-2">
                <a href="${safeUrl}" download="${fileName}" 
                   class="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" />
                    </svg>
                    <div class="text-left">
                        <div class="text-sm font-medium">${fileName}</div>
                        <div class="text-xs text-gray-400">${fileSize}</div>
                    </div>
                </a>
            </div>
        `;
  },
  formatFileGallery(files) {
    if (!files || files.length === 0) return "";
    const images = files.filter((f) => f.filetype && f.filetype.startsWith("image/"));
    const others = files.filter((f) => !f.filetype || !f.filetype.startsWith("image/"));
    let html = "";
    if (images.length > 0) {
      const gridCols = images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3";
      html += `<div class="grid ${gridCols} gap-1.5 mt-2 max-w-md">`;
      const galleryData = btoa(encodeURIComponent(JSON.stringify(images.map((img) => ({ url: img.url, filename: img.filename })))));
      images.forEach((file, index) => {
        const safeUrl = this.sanitizeUrl(file.url);
        const fileName = escapeHtml(file.filename || "image");
        const showOverlay = index === 5 && images.length > 6;
        const hiddenClass = index >= 6 ? "hidden" : "";
        html += `
                    <div class="relative aspect-square rounded-lg overflow-hidden border border-gray-600 cursor-pointer gallery-image ${hiddenClass}"
                         data-gallery-index="${index}" data-gallery-data="${galleryData}">
                        <img src="${safeUrl}" alt="${fileName}" 
                             class="w-full h-full object-cover hover:opacity-90 transition-opacity" 
                             loading="lazy">
                        ${showOverlay ? `
                            <div class="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-lg font-bold">
                                +${images.length - 5}
                            </div>
                        ` : ""}
                    </div>
                `;
      });
      html += "</div>";
    }
    others.forEach((file) => {
      html += this.formatFileContent(file);
    });
    this.ensureLightboxExists();
    return html;
  }
};

// public/js/ui-menu.js
var menus = {
  showContextMenu(event, messageId, canEdit = false) {
    const existingMenu = document.getElementById("message-context-menu");
    if (existingMenu) existingMenu.remove();
    const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    const contentDiv = messageDiv && messageDiv.querySelector(".message-content");
    const replyContent = contentDiv ? this.htmlToPlainText(contentDiv.innerHTML) : "[\uD30C\uC77C]";
    const isOwnMessage = !!(messageDiv && messageDiv.querySelector(".msg-bubble-own"));
    const targetSessionId = messageDiv ? messageDiv.dataset.sessionId : null;
    const menu = document.createElement("div");
    menu.id = "message-context-menu";
    menu.className = "fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 z-50 context-menu-enter";
    menu.style.minWidth = "120px";
    menu.setAttribute("data-ctx-message-id", messageId);
    if (canEdit) menu.setAttribute("data-ctx-can-edit", "true");
    menu.innerHTML = `
            <button class="copy-message-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                \uBCF5\uC0AC\uD558\uAE30
            </button>
            <button class="reply-message-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                \uB2F5\uC7A5\uD558\uAE30
            </button>
            <button class="react-message-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                \uBC18\uC751 \uCD94\uAC00
            </button>
            ${canEdit ? `
            <button class="edit-message-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                \uBA54\uC2DC\uC9C0 \uC218\uC815
            </button>
            <button class="delete-message-btn w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors">
                \uBA54\uC2DC\uC9C0 \uC0AD\uC81C
            </button>
            ` : ""}
        `;
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      menu.remove();
      const mid = menu.getAttribute("data-ctx-message-id");
      if (btn.classList.contains("copy-message-btn")) {
        const msgDiv = this.messagesContainer.querySelector(`[data-message-id="${mid}"]`);
        const cDiv = msgDiv && msgDiv.querySelector(".message-content");
        const text = cDiv ? this.htmlToPlainText(cDiv.innerHTML) : "";
        if (text) {
          navigator.clipboard.writeText(text).catch(() => {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          });
        }
      } else if (btn.classList.contains("reply-message-btn")) {
        this.setReplyingTo(mid, replyContent, isOwnMessage, targetSessionId);
      } else if (btn.classList.contains("edit-message-btn")) {
        const msgDiv = this.messagesContainer.querySelector(`[data-message-id="${mid}"]`);
        if (msgDiv) {
          const cDiv = msgDiv.querySelector(".message-content");
          this.showEditMode(mid, cDiv ? this.htmlToPlainText(cDiv.innerHTML) : "");
        }
      } else if (btn.classList.contains("delete-message-btn")) {
        this.confirmDelete(mid);
      } else if (btn.classList.contains("react-message-btn")) {
        const msgDiv = this.messagesContainer.querySelector(`[data-message-id="${mid}"]`);
        if (msgDiv) this.showReactionPicker(msgDiv, mid);
      }
    });
    const x = event.touches ? event.touches[0].clientX : event.clientX;
    const y = event.touches ? event.touches[0].clientY : event.clientY;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`;
    }
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
        document.removeEventListener("touchstart", closeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", closeMenu);
      document.addEventListener("touchstart", closeMenu);
    }, 100);
  },
  confirmDelete(messageId) {
    if (this.onDelete) {
      this.onDelete(messageId);
    }
  },
  showReactionPicker(messageDiv, messageId) {
    this.removeReactionPicker();
    const picker = document.createElement("div");
    picker.id = "reaction-picker";
    picker.className = "fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 px-2 z-50 flex gap-1";
    const emojis = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F621}"];
    picker.innerHTML = emojis.map((emoji) => {
      const existingBar = messageDiv.querySelector(".reaction-bar");
      const existingPill = existingBar && existingBar.querySelector(`[data-emoji="${emoji}"]`);
      const hasReacted = existingPill && existingPill.classList.contains("bg-blue-600");
      return `<button class="reaction-option text-lg px-1.5 py-0.5 rounded hover:bg-gray-600 transition-colors ${hasReacted ? "ring-1 ring-blue-400 bg-gray-600" : ""}" data-emoji="${emoji}">${emoji}</button>`;
    }).join("");
    const rect = messageDiv.getBoundingClientRect();
    picker.style.left = `${rect.left}px`;
    picker.style.top = `${rect.top - 40}px`;
    picker.addEventListener("click", (e) => {
      const btn = e.target.closest(".reaction-option");
      if (!btn) return;
      const emoji = btn.dataset.emoji;
      const existingBar = messageDiv.querySelector(".reaction-bar");
      const existingPill = existingBar && existingBar.querySelector(`[data-emoji="${emoji}"]`);
      const hasReacted = existingPill && existingPill.classList.contains("bg-blue-600");
      if (this.onReaction) {
        this.onReaction(messageId, emoji, hasReacted);
      }
      this.removeReactionPicker();
    });
    document.body.appendChild(picker);
    const closePicker = (e) => {
      if (!picker.contains(e.target)) {
        this.removeReactionPicker();
        document.removeEventListener("click", closePicker);
      }
    };
    setTimeout(() => document.addEventListener("click", closePicker), 100);
  },
  removeReactionPicker() {
    const picker = document.getElementById("reaction-picker");
    if (picker) picker.remove();
  },
  showChannelContextMenu(event) {
    const existingMenu = document.getElementById("channel-context-menu");
    if (existingMenu) existingMenu.remove();
    const menu = document.createElement("div");
    menu.id = "channel-context-menu";
    menu.className = "fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 z-50";
    menu.style.minWidth = "140px";
    menu.innerHTML = `
            <button class="create-channel-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                \uCC44\uB110 \uCD94\uAC00
            </button>
            <button class="join-channel-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                \uCC44\uB110 \uCC38\uAC00
            </button>
        `;
    const x = event.touches ? event.touches[0].clientX : event.clientX;
    const y = event.touches ? event.touches[0].clientY : event.clientY;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`;
    }
    const createBtn = menu.querySelector(".create-channel-btn");
    const joinBtn = menu.querySelector(".join-channel-btn");
    createBtn.addEventListener("click", () => {
      menu.remove();
      this.showCreateChannelModal();
    });
    joinBtn.addEventListener("click", () => {
      menu.remove();
      this.showJoinChannelModal();
    });
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
        document.removeEventListener("touchstart", closeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", closeMenu);
      document.addEventListener("touchstart", closeMenu);
    }, 100);
  }
};

// public/js/ui-modals.js
var modals = {
  _showModal(modal) {
    if (!modal) return;
    modal.classList.remove("opacity-0", "pointer-events-none");
    modal.classList.add("opacity-100");
    const inner = modal.querySelector(".scale-95");
    if (inner) {
      inner.classList.remove("scale-95");
      inner.classList.add("scale-100");
    }
  },
  _hideModal(modal) {
    if (!modal) return;
    modal.classList.add("opacity-0", "pointer-events-none");
    modal.classList.remove("opacity-100");
    const inner = modal.querySelector(".scale-100");
    if (inner) {
      inner.classList.remove("scale-100");
      inner.classList.add("scale-95");
    }
  },
  showNoticeModal() {
    this._showModal(this.noticeModal);
  },
  hideNoticeModal() {
    this._hideModal(this.noticeModal);
  },
  showCreateChannelModal() {
    if (this.createChannelModal) {
      this.hideJoinChannelModal();
      this._showModal(this.createChannelModal);
      this.createChannelInput.value = "";
      this.createChannelError.classList.add("hidden");
      setTimeout(() => this.createChannelInput.focus(), 50);
    }
  },
  hideCreateChannelModal() {
    if (this.createChannelModal) {
      this._hideModal(this.createChannelModal);
    }
  },
  showCreateChannelError(message) {
    if (this.createChannelError) {
      this.createChannelError.textContent = message;
      this.createChannelError.classList.remove("hidden");
    }
  },
  showJoinChannelModal() {
    if (this.joinChannelModal) {
      this.hideCreateChannelModal();
      this._showModal(this.joinChannelModal);
      this.joinChannelInput.value = "";
      this.joinChannelError.classList.add("hidden");
      setTimeout(() => this.joinChannelInput.focus(), 50);
    }
  },
  hideJoinChannelModal() {
    if (this.joinChannelModal) {
      this._hideModal(this.joinChannelModal);
    }
  },
  showJoinChannelError(message) {
    if (this.joinChannelError) {
      this.joinChannelError.textContent = message;
      this.joinChannelError.classList.remove("hidden");
    }
  },
  updateChannelIndicator(number, name) {
    if (this.channelBadge) {
      if (number && number !== "0" && number !== 0) {
        this.channelBadge.classList.remove("hidden");
        this.channelNumberEl.textContent = number;
        this.channelNameEl.textContent = name || "";
        if (this.backToMainBtn) this.backToMainBtn.classList.remove("hidden");
      } else {
        this.channelBadge.classList.add("hidden");
        if (this.backToMainBtn) this.backToMainBtn.classList.add("hidden");
      }
    }
  }
};

// public/js/ui-edit.js
var editing = {
  showEditMode(messageId, currentContent) {
    const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    let contentDiv = messageDiv.querySelector(".message-content");
    if (!contentDiv) {
      const timeEl = messageDiv.querySelector(".msg-time");
      contentDiv = document.createElement("div");
      contentDiv.className = "text-sm break-words leading-relaxed message-content";
      if (timeEl) {
        timeEl.parentNode.insertBefore(contentDiv, timeEl);
      } else {
        messageDiv.appendChild(contentDiv);
      }
    }
    const originalContent = currentContent;
    contentDiv.innerHTML = `
            <div class="flex flex-col gap-2">
                <textarea class="edit-input bg-gray-800 text-gray-100 border border-gray-600 rounded px-2 py-1 text-sm w-full resize-none"
                          rows="2"
                          maxlength="7500">${escapeHtml(originalContent)}</textarea>
                <div class="flex gap-2 justify-end">
                    <button class="cancel-edit-btn text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded">\uCDE8\uC18C</button>
                    <button class="save-edit-btn text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">\uC800\uC7A5</button>
                </div>
            </div>
        `;
    const editInput = contentDiv.querySelector(".edit-input");
    const cancelBtn = contentDiv.querySelector(".cancel-edit-btn");
    const saveBtn = contentDiv.querySelector(".save-edit-btn");
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    cancelBtn.addEventListener("click", () => {
      if (originalContent) {
        contentDiv.innerHTML = escapeHtml(originalContent);
      } else {
        contentDiv.remove();
      }
    });
    saveBtn.addEventListener("click", () => {
      const newContent = editInput.value.trim();
      if (!newContent) {
        alert("\uBA54\uC2DC\uC9C0 \uB0B4\uC6A9\uC774 \uBE44\uC5B4\uC788\uC2B5\uB2C8\uB2E4.");
        return;
      }
      if (newContent === originalContent) {
        contentDiv.innerHTML = escapeHtml(originalContent);
        return;
      }
      if (window.chatClient) {
        window.chatClient.editMessage(messageId, newContent);
      }
    });
    editInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        saveBtn.click();
      }
      if (e.key === "Escape") {
        cancelBtn.click();
      }
    });
  },
  updateMessage(messageId, newContent, _editedAt) {
    const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    let contentDiv = messageDiv.querySelector(".message-content");
    if (!contentDiv) {
      const timeEl2 = messageDiv.querySelector(".msg-time");
      contentDiv = document.createElement("div");
      contentDiv.className = "text-sm break-words leading-relaxed message-content";
      if (timeEl2) {
        timeEl2.parentNode.insertBefore(contentDiv, timeEl2);
      } else {
        messageDiv.appendChild(contentDiv);
      }
    }
    contentDiv.innerHTML = this.formatMessageContent(newContent);
    const timeEl = messageDiv.querySelector(".msg-time");
    if (timeEl && !timeEl.innerHTML.includes("\uC218\uC815\uB428")) {
      timeEl.innerHTML += ' <span class="text-xs opacity-60">(\uC218\uC815\uB428)</span>';
    }
    const editBtn = messageDiv.querySelector(".edit-message-btn");
    if (editBtn) {
      const messageTimestamp = parseInt(messageDiv.closest("[data-message]").dataset.timestamp || "0");
      if (Date.now() - messageTimestamp >= MESSAGE_EDIT_WINDOW_MS) {
        editBtn.remove();
      }
    }
  },
  removeMessage(messageId) {
    const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
      messageDiv.remove();
    }
  }
};

// public/js/ui-lightbox.js
var lightbox = {
  ensureLightboxExists() {
    if (document.getElementById("gallery-lightbox")) return;
    const lightboxEl = document.createElement("div");
    lightboxEl.id = "gallery-lightbox";
    lightboxEl.className = "fixed inset-0 z-[200] bg-black/90 hidden flex items-center justify-center";
    lightboxEl.innerHTML = `
            <button id="lightbox-close" class="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-50 cursor-pointer">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
            <button id="lightbox-prev" class="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10 hidden">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
            </button>
            <button id="lightbox-next" class="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10 hidden">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </button>
            <div class="max-w-5xl max-h-[90vh] p-4 pointer-events-none">
                <img id="lightbox-img" src="" alt="" class="max-w-full max-h-[85vh] object-contain rounded-lg pointer-events-auto">
                <p id="lightbox-caption" class="text-center text-white/80 mt-3 text-sm pointer-events-auto"></p>
            </div>
        `;
    document.body.appendChild(lightboxEl);
    lightboxEl.addEventListener("click", (e) => {
      if (e.target === lightboxEl || e.target.closest("#lightbox-close")) {
        this.closeLightbox();
      }
    });
    document.getElementById("lightbox-prev").addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigateLightbox(-1);
    });
    document.getElementById("lightbox-next").addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigateLightbox(1);
    });
    if (this._lightboxKeyHandler) {
      document.removeEventListener("keydown", this._lightboxKeyHandler);
    }
    this._lightboxKeyHandler = (e) => {
      if (lightboxEl.classList.contains("hidden")) return;
      if (e.key === "Escape") this.closeLightbox();
      if (e.key === "ArrowLeft") this.navigateLightbox(-1);
      if (e.key === "ArrowRight") this.navigateLightbox(1);
    };
    document.addEventListener("keydown", this._lightboxKeyHandler);
  },
  openLightbox(images, startIndex) {
    this.lightboxImages = images;
    this.lightboxIndex = startIndex;
    this.updateLightbox();
    const lightboxEl = document.getElementById("gallery-lightbox");
    lightboxEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  },
  closeLightbox() {
    const lightboxEl = document.getElementById("gallery-lightbox");
    lightboxEl.classList.add("hidden");
    document.body.style.overflow = "";
    this.lightboxImages = null;
  },
  navigateLightbox(direction) {
    if (!this.lightboxImages) return;
    this.lightboxIndex = (this.lightboxIndex + direction + this.lightboxImages.length) % this.lightboxImages.length;
    this.updateLightbox();
  },
  updateLightbox() {
    const img = document.getElementById("lightbox-img");
    const caption = document.getElementById("lightbox-caption");
    const prev = document.getElementById("lightbox-prev");
    const next = document.getElementById("lightbox-next");
    const current = this.lightboxImages[this.lightboxIndex];
    img.src = this.sanitizeUrl(current.url);
    caption.textContent = `${this.lightboxIndex + 1} / ${this.lightboxImages.length}`;
    if (this.lightboxImages.length > 1) {
      prev.classList.remove("hidden");
      next.classList.remove("hidden");
    }
  }
};

// public/js/ui.js?v=1.1.0
var UIManager = class {
  constructor() {
    this.messageForm = document.getElementById("message-form");
    this.messageInput = document.getElementById("message-input");
    this.sendButton = document.getElementById("send-button");
    this.messagesContainer = document.getElementById("messages-container");
    this.connectionStatus = document.getElementById("connection-status");
    this.userCount = document.getElementById("count-number");
    this.typingIndicator = document.getElementById("typing-indicator");
    this.charCount = document.getElementById("char-count");
    this.scrollButton = document.getElementById("scroll-to-bottom");
    this.nicknameInput = document.getElementById("nickname-input");
    this.nicknameLockBtn = document.getElementById("nickname-lock-btn");
    this.lockIcon = document.getElementById("lock-icon");
    this.unlockIcon = document.getElementById("unlock-icon");
    this.noticeModal = document.getElementById("notice-modal");
    this.noticeAcceptBtn = document.getElementById("notice-accept-btn");
    this.noticeDontShowAgain = document.getElementById("notice-dont-show-again");
    this.replyingTo = null;
    this.onReaction = null;
    this._lastSender = null;
    this._lastTime = null;
    this._lastMessageEl = null;
    this.announcementBanner = document.getElementById("announcement-banner");
    this.announcementContent = document.getElementById("announcement-content");
    this.announcementTime = document.getElementById("announcement-time");
    this.announcementClose = document.getElementById("announcement-close");
    this.channelBadge = document.getElementById("channel-badge");
    this.channelNumberEl = document.getElementById("channel-number");
    this.channelNameEl = document.getElementById("channel-name");
    this.backToMainBtn = document.getElementById("back-to-main-btn");
    this.createChannelModal = document.getElementById("create-channel-modal");
    this.createChannelInput = document.getElementById("create-channel-input");
    this.createChannelError = document.getElementById("create-channel-error");
    this.createChannelConfirm = document.getElementById("create-channel-confirm");
    this.createChannelCancel = document.getElementById("create-channel-cancel");
    this.joinChannelModal = document.getElementById("join-channel-modal");
    this.joinChannelInput = document.getElementById("join-channel-input");
    this.joinChannelError = document.getElementById("join-channel-error");
    this.joinChannelConfirm = document.getElementById("join-channel-confirm");
    this.joinChannelCancel = document.getElementById("join-channel-cancel");
    if (this.announcementClose) {
      this.announcementClose.addEventListener("click", () => {
        this.hideAnnouncement();
      });
    }
    this.initAutoScroll();
    this.messagesContainer.addEventListener("click", (e) => {
      const galleryImage = e.target.closest(".gallery-image");
      if (galleryImage) {
        try {
          const images = JSON.parse(decodeURIComponent(atob(galleryImage.dataset.galleryData)));
          const index = parseInt(galleryImage.dataset.galleryIndex);
          this.openLightbox(images, index);
        } catch (err) {
          console.error("[Gallery] Failed to open lightbox:", err);
        }
      }
    });
    this.messagesContainer.addEventListener("contextmenu", (e) => {
      const msgEl = e.target.closest("[data-message-id]");
      if (msgEl) {
        e.preventDefault();
        const messageId = msgEl.getAttribute("data-message-id");
        const canEdit = msgEl.getAttribute("data-can-edit") === "true";
        this.showContextMenu(e, messageId, canEdit);
      } else if (!e.target.closest("[data-message]")) {
        e.preventDefault();
        this.showChannelContextMenu(e);
      }
    });
    this._longPressTimer = null;
    this.messagesContainer.addEventListener("touchstart", (e) => {
      const msgEl = e.target.closest("[data-message-id]");
      if (!msgEl) return;
      clearTimeout(this._longPressTimer);
      this._longPressTimer = setTimeout(() => {
        const messageId = msgEl.getAttribute("data-message-id");
        const canEdit = msgEl.getAttribute("data-can-edit") === "true";
        this.showContextMenu(e, messageId, canEdit);
      }, 500);
    }, { passive: true });
    this.messagesContainer.addEventListener("touchend", () => {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }, { passive: true });
    this.messagesContainer.addEventListener("touchmove", () => {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }, { passive: true });
    this.messagesContainer.addEventListener("dblclick", (e) => {
      const interactive = e.target.closest('a, button, input, textarea, [role="button"], .reaction-pill');
      if (interactive) return;
      const msgEl = e.target.closest("[data-message-id]");
      if (!msgEl || !this.onReaction) return;
      const messageId = msgEl.getAttribute("data-message-id");
      const bar = msgEl.querySelector(".reaction-bar");
      const existingPill = bar && bar.querySelector('[data-emoji="\u{1F44D}"]');
      const hasReacted = existingPill && existingPill.classList.contains("bg-blue-600");
      this.onReaction(messageId, "\u{1F44D}", hasReacted);
    });
    this.messagesContainer.addEventListener("click", (e) => {
      const pill = e.target.closest(".reaction-pill");
      if (pill && this.onReaction) {
        e.stopPropagation();
        const messageId = pill.getAttribute("data-message-id");
        const emoji = pill.getAttribute("data-emoji");
        const hasReacted = pill.classList.contains("bg-blue-600");
        this.onReaction(messageId, emoji, hasReacted);
        return;
      }
      const revealBtn = e.target.closest(".reveal-secret-btn");
      if (revealBtn && this.onRevealSecret) {
        const secretId = revealBtn.getAttribute("data-secret-id");
        const container = revealBtn.closest(".secret-message-container");
        if (container) {
          this.onRevealSecret(secretId, container);
        }
        return;
      }
      const replyRef = e.target.closest(".reply-reference");
      if (replyRef) {
        const replyId = replyRef.getAttribute("data-reply-to-id");
        if (replyId) this.highlightMessage(replyId);
        return;
      }
      const msgEl = e.target.closest("[data-message-id]");
      if (msgEl && !e.target.closest('a, button, input, textarea, [role="button"], .secret-message-container')) {
        const replyToId = msgEl.getAttribute("data-reply-to");
        if (replyToId) {
          this.highlightMessage(replyToId);
        }
      }
    });
  }
  /**
   * MutationObserver를 사용하여 새 메시지 추가 시 자동 스크롤
   */
  initAutoScroll() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute("data-message")) {
              const container = this.messagesContainer;
              const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < UI.SCROLL_PROXIMITY_PX;
              if (isAtBottom) {
                this.scrollToBottom();
              } else {
                this.scrollButton.classList.remove("opacity-0", "pointer-events-none");
                this.scrollButton.classList.add("opacity-100", "pointer-events-auto");
              }
              return;
            }
          }
        }
      }
    });
    observer.observe(this.messagesContainer, {
      childList: true,
      subtree: false
    });
  }
  initializeEventListeners(callbacks) {
    this.messageForm.addEventListener("submit", callbacks.onSubmit);
    this.messageInput.addEventListener("input", callbacks.onInput);
    this.messageInput.addEventListener("keydown", callbacks.onTyping);
    this.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (typeof this.messageForm.requestSubmit === "function") {
          this.messageForm.requestSubmit();
        } else {
          callbacks.onSubmit(new Event("submit", { bubbles: true, cancelable: true }));
        }
      }
    });
    this.messageInput.addEventListener("input", () => {
      this.charCount.textContent = this.messageInput.value.length;
      this.messageInput.style.height = "auto";
      const maxH = 200;
      const scrollH = this.messageInput.scrollHeight;
      this.messageInput.style.height = Math.min(scrollH, maxH) + "px";
      this.messageInput.style.overflowY = scrollH > maxH ? "auto" : "hidden";
    });
    this.scrollButton.addEventListener("click", callbacks.onScrollClick);
    this.messagesContainer.addEventListener("scroll", callbacks.onScroll);
    if (this.nicknameInput && callbacks.onSetNickname) {
      this.nicknameInput.addEventListener("change", (e) => {
        callbacks.onSetNickname(e.target.value);
      });
    }
    if (this.nicknameLockBtn && callbacks.onToggleNicknameLock) {
      this.nicknameLockBtn.addEventListener("click", () => {
        callbacks.onToggleNicknameLock();
      });
    }
    if (this.noticeAcceptBtn && callbacks.onAcceptNotice) {
      this.noticeAcceptBtn.addEventListener("click", () => {
        const dontShowAgain = this.noticeDontShowAgain ? this.noticeDontShowAgain.checked : false;
        callbacks.onAcceptNotice(dontShowAgain);
        this.hideNoticeModal();
      });
    }
    this._channelProcessing = false;
    if (this.createChannelConfirm && callbacks.onCreateChannel) {
      this.createChannelConfirm.addEventListener("click", () => {
        if (this._channelProcessing) return;
        const name = this.createChannelInput.value.trim();
        callbacks.onCreateChannel(name);
      });
    }
    if (this.createChannelCancel) {
      this.createChannelCancel.addEventListener("click", () => this.hideCreateChannelModal());
    }
    if (this.createChannelInput) {
      this.createChannelInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!this._channelProcessing) this.createChannelConfirm.click();
        }
        if (e.key === "Escape") this.hideCreateChannelModal();
      });
    }
    if (this.joinChannelConfirm && callbacks.onJoinChannel) {
      this.joinChannelConfirm.addEventListener("click", () => {
        if (this._channelProcessing) return;
        const raw = this.joinChannelInput.value.trim();
        callbacks.onJoinChannel(raw);
      });
    }
    if (this.joinChannelCancel) {
      this.joinChannelCancel.addEventListener("click", () => this.hideJoinChannelModal());
    }
    if (this.joinChannelInput) {
      this.joinChannelInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!this._channelProcessing) this.joinChannelConfirm.click();
        }
        if (e.key === "Escape") this.hideJoinChannelModal();
      });
    }
    if (this.backToMainBtn && callbacks.onBackToMain) {
      this.backToMainBtn.addEventListener("click", () => callbacks.onBackToMain());
    }
    if (this.createChannelModal) {
      this.createChannelModal.addEventListener("click", (e) => {
        if (e.target === this.createChannelModal) this.hideCreateChannelModal();
      });
    }
    if (this.joinChannelModal) {
      this.joinChannelModal.addEventListener("click", (e) => {
        if (e.target === this.joinChannelModal) this.hideJoinChannelModal();
      });
    }
    this.onDelete = callbacks.onDelete;
    this.onRevealSecret = callbacks.onRevealSecret;
    this.onReaction = callbacks.onReaction;
  }
  updateNicknameDisplay(name) {
    if (this.nicknameInput) {
      this.nicknameInput.value = name && name !== "\uC775\uBA85" ? name : "";
    }
  }
  setNicknameLockState(isLocked) {
    if (!this.nicknameInput || !this.nicknameLockBtn) return;
    if (isLocked) {
      this.nicknameInput.readOnly = true;
      this.nicknameInput.classList.add("opacity-80", "cursor-not-allowed");
      this.nicknameLockBtn.classList.remove("hidden");
      this.nicknameLockBtn.title = "\uB2C9\uB124\uC784 \uBCC0\uACBD \uBCF4\uD638\uB428";
      this.nicknameLockBtn.setAttribute("aria-label", "\uB2C9\uB124\uC784 \uC7A0\uAE08 \uD574\uC81C");
    } else {
      this.nicknameInput.readOnly = false;
      this.nicknameInput.classList.remove("opacity-80", "cursor-not-allowed");
      this.nicknameLockBtn.classList.add("hidden");
      this.nicknameLockBtn.title = "\uB2C9\uB124\uC784 \uBCC0\uACBD \uAC00\uB2A5";
      this.nicknameLockBtn.setAttribute("aria-label", "\uB2C9\uB124\uC784 \uBCC0\uACBD \uAC00\uB2A5");
      this.nicknameInput.focus();
    }
  }
  displaySystemMessage(content) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "text-center text-xs text-gray-500 py-1.5 system-message-enter";
    messageDiv.textContent = content;
    messageDiv.setAttribute("data-message", "true");
    messageDiv.setAttribute("data-system-message", "true");
    this.messagesContainer.appendChild(messageDiv);
    const prevLoading = this.messagesContainer.querySelectorAll("[data-loading-summary]");
    prevLoading.forEach((el) => el.remove());
    if (content.includes("AI\uAC00 \uB300\uD654 \uC694\uC57D\uC744 \uC0DD\uC131 \uC911\uC785\uB2C8\uB2E4")) {
      messageDiv.setAttribute("data-loading-summary", "true");
    }
    if (content.includes("\uC785\uC7A5\uD588\uC2B5\uB2C8\uB2E4")) {
      setTimeout(() => messageDiv.remove(), UI.SYSTEM_MESSAGE_TIMEOUT_MS);
    }
    return messageDiv;
  }
  _clearLoadingSummary() {
    const loading = this.messagesContainer.querySelector("[data-loading-summary]");
    if (loading) loading.remove();
  }
  displaySummary(summaryText, messageId, mode = "default") {
    if (messageId && this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`)) {
      return;
    }
    this._clearLoadingSummary();
    const MODE_STYLES = {
      default: { bg: "bg-indigo-900/40", border: "border-indigo-700/50", title: "text-indigo-300", label: "AI \uB300\uD654 \uC694\uC57D" },
      topic: { bg: "bg-emerald-900/40", border: "border-emerald-700/50", title: "text-emerald-300", label: "\uB300\uD654 \uC8FC\uC81C" },
      mood: { bg: "bg-amber-900/40", border: "border-amber-700/50", title: "text-amber-300", label: "\uB300\uD654 \uBD84\uC704\uAE30" },
      conflict: { bg: "bg-red-900/40", border: "border-red-700/50", title: "text-red-300", label: "\uC758\uACAC \uCDA9\uB3CC" }
    };
    const s = MODE_STYLES[mode] || MODE_STYLES.default;
    const wrapper = document.createElement("div");
    wrapper.className = `${s.bg} ${s.border} border rounded-lg p-3 mx-2 my-3`;
    wrapper.setAttribute("data-message", "true");
    if (messageId) {
      wrapper.setAttribute("data-message-id", messageId);
    }
    const title = document.createElement("div");
    title.className = `text-xs font-semibold mb-2 ${s.title}`;
    title.textContent = s.label;
    const content = document.createElement("div");
    content.className = "text-sm text-gray-200 leading-relaxed";
    content.textContent = summaryText;
    wrapper.appendChild(title);
    wrapper.appendChild(content);
    this.messagesContainer.appendChild(wrapper);
  }
  displayAnnouncement(_content, _timestamp) {
  }
  hideAnnouncement() {
    if (this.announcementBanner) {
      this.announcementBanner.style.maxHeight = "0";
      this.announcementBanner.style.opacity = "0";
    }
  }
  displayError(content) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "text-center text-xs text-red-400 py-2 bg-red-900/20 rounded-lg mx-4";
    errorDiv.textContent = content;
    errorDiv.setAttribute("data-message", "true");
    this.messagesContainer.appendChild(errorDiv);
    setTimeout(() => {
      errorDiv.remove();
    }, UI.ERROR_BANNER_TIMEOUT_MS);
  }
  updateUserCount(count) {
    this.userCount.textContent = count;
  }
  updateConnectionStatus(status, text) {
    const statusDot = this.connectionStatus.querySelector(".w-2");
    const statusText = this.connectionStatus.querySelector(".text-xs");
    statusText.textContent = text;
    const colors = {
      connecting: "bg-yellow-500",
      connected: "bg-green-500",
      disconnected: "bg-red-500",
      reconnecting: "bg-orange-500",
      error: "bg-red-600"
    };
    statusDot.className = `w-2 h-2 rounded-full ${colors[status] || "bg-gray-500"}`;
  }
  updateTypingIndicator(typingUsers) {
    const count = typingUsers.size;
    if (count === 0) {
      this.typingIndicator.classList.add("hidden");
      return;
    }
    this.typingIndicator.classList.remove("hidden");
    const users = Array.from(typingUsers.values()).map((u) => escapeHtml(u.nickname || "\uC775\uBA85"));
    let text;
    if (count === 1) {
      text = `${users[0]}\uB2D8\uC774 \uC785\uB825 \uC911`;
    } else if (count === 2) {
      text = `${users[0]}, ${users[1]}\uB2D8\uC774 \uC785\uB825 \uC911`;
    } else {
      text = `${users[0]} \uC678 ${count - 1}\uBA85\uC774 \uC785\uB825 \uC911`;
    }
    this.typingIndicator.innerHTML = `<span>\u25CF</span><span>\u25CF</span><span>\u25CF</span> ${text}`;
  }
  setInputEnabled(enabled) {
    this.sendButton.disabled = !enabled;
    this.messageInput.disabled = !enabled;
  }
  clearInput() {
    this.messageInput.value = "";
    this.charCount.textContent = "0";
    this.messageInput.style.height = "";
  }
  getInputValue() {
    return this.messageInput.value;
  }
  getInputLength() {
    return this.messageInput.value.length;
  }
  scrollToBottom(smooth = false) {
    const container = this.messagesContainer;
    if (smooth) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      });
    } else {
      container.scrollTop = container.scrollHeight;
    }
    this.updateScrollButton();
  }
  updateScrollButton() {
    const container = this.messagesContainer;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isAtBottom) {
      this.scrollButton.classList.add("opacity-0", "pointer-events-none");
      this.scrollButton.classList.remove("opacity-100", "pointer-events-auto");
    } else {
      this.scrollButton.classList.remove("opacity-0", "pointer-events-none");
      this.scrollButton.classList.add("opacity-100", "pointer-events-auto");
    }
  }
  updateReaction(messageId, emoji, count, reactionSessions, currentSessionId) {
    const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    let bar = messageDiv.querySelector(".reaction-bar");
    if (count === 0) {
      const pill2 = bar && bar.querySelector(`[data-emoji="${emoji}"]`);
      if (pill2) pill2.remove();
      if (bar && bar.children.length === 0) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "reaction-bar flex flex-wrap gap-1 mt-2";
      messageDiv.appendChild(bar);
    }
    let pill = bar.querySelector(`[data-emoji="${emoji}"]`);
    let isNewPill = false;
    if (!pill) {
      isNewPill = true;
      pill = document.createElement("button");
      pill.className = "reaction-pill inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-600 text-gray-200 hover:bg-gray-500";
      pill.setAttribute("data-emoji", emoji);
      pill.setAttribute("data-message-id", messageId);
      bar.appendChild(pill);
    }
    const userReacted = reactionSessions && reactionSessions.includes(currentSessionId);
    pill.className = userReacted ? "reaction-pill inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-600 text-white ring-1 ring-blue-400" : "reaction-pill inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-600 text-gray-200 hover:bg-gray-500";
    pill.innerHTML = `${emoji} ${count}`;
    if (isNewPill) {
      pill.classList.add("reaction-just-added");
      pill.addEventListener("animationend", () => pill.classList.remove("reaction-just-added"), { once: true });
    }
  }
  clearAllMessages() {
    const messages = this.messagesContainer.querySelectorAll("[data-message-id]");
    messages.forEach((msg) => msg.remove());
  }
  setReplyingTo(messageId, content, isOwnMessage, targetSessionId) {
    this.replyingTo = { messageId, content, isOwnMessage, targetSessionId, isSecret: false };
    this.showReplyPreview();
    this.messageInput.focus();
  }
  showReplyPreview() {
    const existingPreview = document.getElementById("reply-preview");
    if (existingPreview) {
      existingPreview.remove();
    }
    if (!this.replyingTo) return;
    const preview = document.createElement("div");
    preview.id = "reply-preview";
    preview.className = "bg-gray-700/50 border-l-4 border-blue-500 p-2 mb-2 text-sm flex flex-col gap-2";
    const truncatedContent = this.replyingTo.content.length > 50 ? this.replyingTo.content.substring(0, UI.REPLY_PREVIEW_LENGTH) + "..." : this.replyingTo.content;
    preview.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1">
                    <div class="text-xs text-blue-400 mb-1">${this.replyingTo.isOwnMessage ? "\uB0B4 \uBA54\uC2DC\uC9C0" : "\uC775\uBA85"}\uC5D0\uAC8C \uB2F5\uC7A5</div>
                    <div class="text-gray-300">${escapeHtml(truncatedContent)}</div>
                </div>
                <button class="cancel-reply-btn text-gray-400 hover:text-white flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <label class="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-200 transition-colors">
                <input type="checkbox" id="secret-reply-checkbox" class="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0">
                <span>\uBE44\uBC00 \uBA54\uC2DC\uC9C0\uB85C \uBCF4\uB0B4\uAE30 (\uBC1B\uB294 \uC0AC\uB78C\uB9CC \uD55C \uBC88 \uBCFC \uC218 \uC788\uC74C)</span>
            </label>
        `;
    const cancelBtn = preview.querySelector(".cancel-reply-btn");
    cancelBtn.addEventListener("click", () => {
      this.cancelReply();
    });
    const secretCheckbox = preview.querySelector("#secret-reply-checkbox");
    secretCheckbox.addEventListener("change", (e) => {
      this.replyingTo.isSecret = e.target.checked;
    });
    this.messageForm.parentElement.insertBefore(preview, this.messageForm);
  }
  cancelReply() {
    this.replyingTo = null;
    const preview = document.getElementById("reply-preview");
    if (preview) {
      preview.remove();
    }
  }
  getReplyingTo() {
    return this.replyingTo;
  }
};
Object.assign(UIManager.prototype, rendering);
Object.assign(UIManager.prototype, menus);
Object.assign(UIManager.prototype, modals);
Object.assign(UIManager.prototype, editing);
Object.assign(UIManager.prototype, lightbox);

// public/js/file-upload.js?v=1.0.5
var FileUploadManager = class {
  constructor(apiBaseUrl, uploadEndpoint) {
    this.apiBaseUrl = apiBaseUrl || null;
    this.uploadEndpoint = uploadEndpoint || "/api/upload";
    this.fileInput = document.getElementById("file-input");
    this.fileButton = document.getElementById("file-button");
    this.filePreview = document.getElementById("file-preview");
    this.previewGallery = document.getElementById("preview-gallery");
    this.fileName = document.getElementById("file-name");
    this.fileSize = document.getElementById("file-size");
    this.removeFileBtn = document.getElementById("remove-file");
    this.uploadProgress = document.getElementById("upload-progress");
    this.uploadPercent = document.getElementById("upload-percent");
    this.uploadProgressBar = document.getElementById("upload-progress-bar");
    this.sendButton = document.getElementById("send-button");
    this.selectedFiles = [];
    this.uploadedFiles = [];
    this.uploadXhr = null;
    this.isUploading = false;
    this.maxFileSize = FILE_UPLOAD_CLIENT.MAX_BYTES;
    this.maxFiles = FILE_UPLOAD_CLIENT.MAX_FILES;
    this.initializeEventListeners();
  }
  initializeEventListeners() {
    this.fileButton.addEventListener("click", () => {
      this.fileInput.click();
    });
    this.fileInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        this.selectedFiles = [];
        this.handleFileSelection(files);
      }
    });
    this.removeFileBtn.addEventListener("click", () => {
      if (!this.isUploading) {
        this.clearFiles();
      }
    });
    this.previewGallery.addEventListener("click", (e) => {
      const btn = e.target.closest(".remove-file-btn");
      if (!btn) return;
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      this.selectedFiles.splice(idx, 1);
      this.showPreview();
    });
    document.addEventListener("paste", (e) => this.handlePaste(e));
  }
  handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const namedFile = new File([file], `pasted-image-${Date.now()}.${file.type.split("/")[1] || "png"}`, { type: file.type });
          pastedFiles.push(namedFile);
        }
      }
    }
    if (pastedFiles.length > 0) {
      this.handleFileSelection(pastedFiles);
    }
  }
  handleFileSelection(files) {
    if (this.selectedFiles.length + files.length > this.maxFiles) {
      alert(`\uCD5C\uB300 ${this.maxFiles}\uAC1C\uC758 \uD30C\uC77C\uB9CC \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`);
      files = files.slice(0, this.maxFiles - this.selectedFiles.length);
    }
    const validFiles = files.filter((file) => {
      if (file.size > this.maxFileSize) {
        alert(`'${file.name}'\uC758 \uD06C\uAE30\uAC00 ${this.maxFileSize / 1024 / 1024}MB\uB97C \uCD08\uACFC\uD558\uC5EC \uC81C\uC678\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`);
        return false;
      }
      return true;
    });
    this.selectedFiles.push(...validFiles);
    this.showPreview();
  }
  showPreview() {
    if (this.selectedFiles.length === 0) {
      this.clearFiles();
      return;
    }
    const totalSize = this.selectedFiles.reduce((sum, f) => sum + f.size, 0);
    this.fileName.textContent = `${this.selectedFiles.length}\uAC1C \uD30C\uC77C`;
    this.fileSize.textContent = formatFileSize(totalSize);
    this.previewGallery.innerHTML = "";
    this.selectedFiles.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "relative aspect-square rounded border border-gray-600 overflow-hidden bg-gray-800";
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          item.innerHTML = `
                        <img src="${e.target.result}" alt="${escapeHtml(file.name)}" class="w-full h-full object-cover">
                        <button class="remove-file-btn absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-xs"
                            data-index="${index}">\xD7</button>
                    `;
        };
        reader.readAsDataURL(file);
      } else {
        item.innerHTML = `
                    <div class="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <span class="text-[10px] px-1 truncate w-full text-center">${escapeHtml(file.name)}</span>
                    </div>
                    <button class="remove-file-btn absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-xs"
                        data-index="${index}">\xD7</button>
                `;
      }
      this.previewGallery.appendChild(item);
    });
    this.filePreview.classList.remove("hidden");
    this.adjustMessagesContainerPadding();
    this.adjustBugReportButtonPosition();
  }
  adjustMessagesContainerPadding() {
    requestAnimationFrame(() => {
      const messagesContainer = document.querySelector("main");
      const previewHeight = this.filePreview.offsetHeight;
      messagesContainer.style.paddingBottom = `calc(8rem + ${previewHeight}px)`;
    });
  }
  adjustBugReportButtonPosition() {
    requestAnimationFrame(() => {
      const bugReportBtn = document.getElementById("bug-report-btn");
      if (!bugReportBtn) return;
      const previewHeight = this.filePreview.offsetHeight;
      const totalOffset = 144 + previewHeight;
      bugReportBtn.style.bottom = `${totalOffset}px`;
    });
  }
  resetBugReportButtonPosition() {
    const bugReportBtn = document.getElementById("bug-report-btn");
    if (!bugReportBtn) return;
    bugReportBtn.style.bottom = "144px";
  }
  clearFiles() {
    if (this.uploadXhr) {
      this.uploadXhr.abort();
      this.uploadXhr = null;
    }
    this.selectedFiles = [];
    this.uploadedFiles = [];
    this.isUploading = false;
    this.fileInput.value = "";
    this.filePreview.classList.add("hidden");
    this.previewGallery.innerHTML = "";
    this.fileName.textContent = "";
    this.fileSize.textContent = "";
    this.hideUploadProgress();
    const messagesContainer = document.querySelector("main");
    messagesContainer.style.paddingBottom = "8rem";
    this.resetBugReportButtonPosition();
  }
  showUploadProgress() {
    this.isUploading = true;
    this.uploadProgress.classList.remove("hidden");
    this.removeFileBtn.disabled = true;
    this.removeFileBtn.classList.add("opacity-50", "cursor-not-allowed");
    if (this.sendButton) {
      this.sendButton.disabled = true;
      this.sendButton.classList.add("opacity-50");
    }
    this.updateUploadProgress(0);
  }
  hideUploadProgress() {
    this.isUploading = false;
    this.uploadProgress.classList.add("hidden");
    this.removeFileBtn.disabled = false;
    this.removeFileBtn.classList.remove("opacity-50", "cursor-not-allowed");
    if (this.sendButton) {
      this.sendButton.disabled = false;
      this.sendButton.classList.remove("opacity-50");
    }
    this.updateUploadProgress(0);
  }
  updateUploadProgress(percent) {
    const roundedPercent = Math.round(percent);
    this.uploadPercent.textContent = `${roundedPercent}%`;
    this.uploadProgressBar.style.width = `${roundedPercent}%`;
  }
  async uploadFiles() {
    if (this.selectedFiles.length === 0) {
      return [];
    }
    if (this.isUploading) {
      throw new Error("Upload already in progress");
    }
    this.uploadedFiles = [];
    this.showUploadProgress();
    const maxConcurrency = FILE_UPLOAD_CLIENT.CONCURRENT_UPLOADS;
    const progressMap = /* @__PURE__ */ new Map();
    const updateTotalProgress = () => {
      let total = 0;
      progressMap.forEach((v) => total += v);
      const avg = total / this.selectedFiles.length;
      const percent = Math.round(avg * 100);
      this.updateUploadProgress(percent);
    };
    try {
      const results = new Array(this.selectedFiles.length);
      let completed = 0;
      const uploadWithProgress = async (file, index) => {
        progressMap.set(index, 0);
        const result = await this.uploadSingleFile(file, (percent) => {
          progressMap.set(index, percent);
          updateTotalProgress();
        });
        progressMap.set(index, 1);
        completed++;
        this.uploadPercent.textContent = `${completed}/${this.selectedFiles.length}`;
        results[index] = result;
        updateTotalProgress();
      };
      for (let i = 0; i < this.selectedFiles.length; i += maxConcurrency) {
        const batch = [];
        for (let j = i; j < Math.min(i + maxConcurrency, this.selectedFiles.length); j++) {
          batch.push(uploadWithProgress(this.selectedFiles[j], j));
        }
        await Promise.all(batch);
      }
      this.uploadedFiles = results;
      this.hideUploadProgress();
      return this.uploadedFiles;
    } catch (error) {
      this.hideUploadProgress();
      throw error;
    }
  }
  async uploadSingleFile(file, onProgress) {
    if (file.size > UPLOAD.WORKER_BODY_LIMIT) {
      return this.uploadChunkedFile(file, onProgress);
    }
    return new Promise((resolve, reject) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const xhr = new XMLHttpRequest();
        this.uploadXhr = xhr;
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable && onProgress) {
            const percent = e.loaded / e.total;
            onProgress(percent);
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              let uploadedFileUrl;
              if (result.full_url) {
                uploadedFileUrl = result.full_url;
              } else if (result.url && result.url.startsWith("http")) {
                uploadedFileUrl = result.url;
              } else if (result.url) {
                if (!this.apiBaseUrl) {
                  reject(new Error("Upload not configured"));
                  return;
                }
                uploadedFileUrl = `${this.apiBaseUrl}${result.url}`;
              } else if (result.id && result.name) {
                if (!this.apiBaseUrl) {
                  reject(new Error("Upload not configured"));
                  return;
                }
                uploadedFileUrl = `${this.apiBaseUrl}/${result.id}/${result.name}`;
              } else {
                reject(new Error("Invalid upload response"));
                return;
              }
              resolve({
                url: uploadedFileUrl,
                filename: file.name,
                filesize: file.size,
                filetype: file.type
              });
            } catch (parseError) {
              console.error("Upload response parse error:", parseError);
              reject(new Error("Invalid upload response"));
            }
          } else {
            const errorText = xhr.responseText;
            console.error("Upload error response:", errorText);
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        });
        xhr.addEventListener("error", () => {
          console.error("Upload network error");
          reject(new Error("Network error during upload"));
        });
        xhr.addEventListener("abort", () => {
          reject(new Error("Upload cancelled"));
        });
        xhr.open("POST", this.uploadEndpoint);
        xhr.send(formData);
      } catch (error) {
        console.error("File upload error:", error);
        reject(error);
      }
    });
  }
  async uploadChunkedFile(file, onProgress) {
    const chunkSize = UPLOAD.CHUNK_SIZE;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const concurrency = UPLOAD.CHUNK_CONCURRENCY;
    const initResp = await fetch("/api/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, totalSize: file.size, contentType: file.type })
    });
    if (!initResp.ok) throw new Error(`Init failed: ${initResp.status}`);
    const initData = await initResp.json();
    if (!initData.success || !initData.data) throw new Error("Invalid init response");
    const { uploadId, fileId } = initData.data;
    const parts = [];
    let uploaded = 0;
    const sendChunk = async (partNumber) => {
      const start = (partNumber - 1) * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const blob = file.slice(start, end);
      const resp = await fetch(`/api/upload/${encodeURIComponent(uploadId)}/part?partNumber=${partNumber}&fileId=${encodeURIComponent(fileId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob
      });
      if (!resp.ok) throw new Error(`Chunk ${partNumber} failed: ${resp.status}`);
      const result = await resp.json();
      if (!result.success) throw new Error(`Chunk ${partNumber} error: ${result.error?.message}`);
      parts[partNumber - 1] = { partNumber: result.data.partNumber, etag: result.data.etag };
      uploaded++;
      if (onProgress) onProgress(uploaded / totalChunks);
    };
    for (let i = 0; i < totalChunks; i += concurrency) {
      const batch = [];
      for (let j = i; j < Math.min(i + concurrency, totalChunks); j++) {
        batch.push(sendChunk(j + 1));
      }
      await Promise.all(batch);
    }
    parts.sort((a, b) => a.partNumber - b.partNumber);
    const completeResp = await fetch(`/api/upload/${encodeURIComponent(uploadId)}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, parts })
    });
    if (!completeResp.ok) throw new Error(`Complete failed: ${completeResp.status}`);
    const completeResult = await completeResp.json();
    let uploadedFileUrl;
    if (completeResult.full_url) {
      uploadedFileUrl = completeResult.full_url;
    } else if (completeResult.url && completeResult.url.startsWith("http")) {
      uploadedFileUrl = completeResult.url;
    } else if (completeResult.url) {
      if (!this.apiBaseUrl) throw new Error("Upload not configured");
      uploadedFileUrl = `${this.apiBaseUrl}${completeResult.url}`;
    } else {
      throw new Error("Invalid upload response");
    }
    if (onProgress) onProgress(1);
    return {
      url: uploadedFileUrl,
      filename: file.name,
      filesize: file.size,
      filetype: file.type
    };
  }
  hasFile() {
    return this.selectedFiles.length > 0;
  }
  // Drag and drop support
  enableDragAndDrop(dropZone) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("border-blue-500", "bg-blue-900/10");
    });
    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropZone.classList.remove("border-blue-500", "bg-blue-900/10");
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("border-blue-500", "bg-blue-900/10");
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        this.handleFileSelection(files);
      }
    });
  }
};

// public/js/dead-drop.js?v=1.0.3
var DeadDropClient = class {
  constructor() {
    this._storeUrl = "/api/secret-store";
    this._readUrl = "/api/secret-read";
  }
  /**
   * Store a secret message
   * @param {string} message - The secret message to store
   * @returns {Promise<{id: string}>} - The ID to retrieve the message
   */
  async store(message) {
    try {
      const response = await fetch(this._storeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Secret store error:", error);
      throw error;
    }
  }
  /**
   * Read and consume a secret message (single-use)
   * @param {string} id - The message ID
   * @returns {Promise<{message: string}>} - The secret message
   */
  async read(id) {
    try {
      const response = await fetch(`${this._readUrl}?id=${encodeURIComponent(id)}`);
      if (!response.ok) {
        if (response.status === 404 || response.status === 410) {
          throw new Error("\uBA54\uC2DC\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uAC70\uB098 \uC774\uBBF8 \uC77D\uD614\uC2B5\uB2C8\uB2E4.");
        }
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Secret read error:", error);
      throw error;
    }
  }
};

// public/js/push-manager.js?v=1.0.5
var PushNotificationManager = class {
  constructor() {
    this.swRegistration = null;
    this.isSubscribed = false;
    this.vapidPublicKey = null;
    this._sessionSubscribed = false;
  }
  async initialize() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { supported: false, subscribed: false };
    }
    try {
      this.swRegistration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const response = await fetch("/api/push/vapid-key");
      if (!response.ok) {
        const errorData = await response.json();
        console.warn("[Push] VAPID key not available:", errorData.error);
        return { supported: false, subscribed: false, error: "Push notifications not configured" };
      }
      const data = await response.json();
      if (!data.publicKey) {
        console.error("[Push] Server returned empty VAPID key");
        return { supported: false, subscribed: false, error: "Invalid server response" };
      }
      this.vapidPublicKey = data.publicKey.trim();
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        this.isSubscribed = true;
        this._sessionSubscribed = true;
      } else {
        const stored = sessionStorage.getItem("pushSubscribed");
        if (stored === "true") {
          this._sessionSubscribed = true;
        }
      }
      navigator.serviceWorker.addEventListener("message", (_event) => {
      });
      return { supported: true, subscribed: this.isSubscribed };
    } catch (error) {
      console.error("[Push] Initialization failed:", error);
      return { supported: false, subscribed: false, error: error.message };
    }
  }
  /**
   * Request notification permission and subscribe
   * @param {string} sessionId - Current user's session ID
   * @returns {Promise<boolean>}
   */
  async subscribe(sessionId) {
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.getFcmToken === "function") {
        const fcmToken = window.AndroidBridge.getFcmToken();
        if (!fcmToken) {
          console.error("[Push] \u2717 AndroidBridge returned empty FCM token.");
          return false;
        }
        const response2 = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: fcmToken,
            sessionId,
            isFcmToken: true
          })
        });
        if (response2.ok) {
          this.isSubscribed = true;
          this._sessionSubscribed = true;
          sessionStorage.setItem("pushSubscribed", "true");
          return true;
        } else {
          const errorText = await response2.text();
          console.error("[Push] \u2717 Server rejected FCM subscription:", response2.status, errorText);
          return false;
        }
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return false;
      }
      if (!this.swRegistration) {
        const initResult = await this.initialize();
        if (!initResult.supported) {
          console.error("[Push] Initialization failed:", initResult.error);
          return false;
        }
      }
      if (!this.vapidPublicKey) {
        console.error("[Push] VAPID public key not available");
        return false;
      }
      const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          sessionId,
          isFcmToken: false
        })
      });
      if (response.ok) {
        this.isSubscribed = true;
        this._sessionSubscribed = true;
        sessionStorage.setItem("pushSubscribed", "true");
        return true;
      } else {
        const errorText = await response.text();
        console.error("[Push] \u2717 Server rejected subscription:", response.status, errorText);
        return false;
      }
    } catch (error) {
      console.error("[Push] \u2717 Subscribe failed:", error.name, error.message);
      return false;
    }
  }
  /**
   * Unsubscribe from push notifications
   * @param {string} sessionId
   * @returns {Promise<boolean>}
   */
  async unsubscribe(sessionId) {
    try {
      const subscription = await this.swRegistration?.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      this.isSubscribed = false;
      this._sessionSubscribed = false;
      sessionStorage.removeItem("pushSubscribed");
      return true;
    } catch (error) {
      console.error("[Push] Unsubscribe failed:", error);
      return false;
    }
  }
  /**
   * Toggle subscription state
   * @param {string} sessionId
   * @returns {Promise<boolean|undefined>} new subscription state, or undefined on error
   */
  async toggle(sessionId) {
    try {
      if (this.isSubscribed) {
        const success = await this.unsubscribe(sessionId);
        if (!success) {
          console.error("[Push] Failed to unsubscribe");
          return void 0;
        }
      } else {
        const success = await this.subscribe(sessionId);
        if (!success) {
          console.error("[Push] Failed to subscribe");
          return void 0;
        }
      }
      return this.isSubscribed;
    } catch (error) {
      console.error("[Push] Toggle error:", error);
      return void 0;
    }
  }
  /**
   * Check if push notifications are supported
   */
  static isSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }
  /**
   * Get current permission state
   */
  static getPermissionState() {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  }
  /**
   * Convert base64url to Uint8Array (for applicationServerKey)
   */
  urlBase64ToUint8Array(base64String) {
    if (!base64String || typeof base64String !== "string") {
      throw new Error("VAPID public key is empty or invalid");
    }
    try {
      const padding = "=".repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    } catch (error) {
      console.error("[Push] Failed to decode VAPID key:", error);
      throw new Error("Invalid VAPID public key format: " + error.message);
    }
  }
};

// public/js/search.js?v=1.0.3
var SearchManager = class {
  constructor(onResultClick) {
    this.onResultClick = onResultClick;
    this.isOpen = false;
    this.currentQuery = "";
    this.searchTimeout = null;
    this.results = [];
    this.overlay = null;
    this.searchInput = null;
    this.resultsContainer = null;
    this.resultCountEl = null;
    this.activeTags = /* @__PURE__ */ new Set();
    this.createOverlay();
    this.attachHeaderButton();
  }
  createOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.id = "search-overlay";
    this.overlay.className = "fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm hidden";
    this.overlay.innerHTML = `
            <div class="fixed inset-0 md:inset-y-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-gray-800 shadow-2xl flex flex-col md:rounded-xl overflow-hidden border border-gray-700">
                <div class="flex items-center gap-3 p-4 border-b border-gray-700">
                    <svg class="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    <input id="search-input" type="text" placeholder="\uAC80\uC0C9\uC5B4 \uC785\uB825... (#images #files #code #url \uD0DC\uADF8\uB85C\uB9CC \uD544\uD130\uB9C1)" 
                        class="flex-1 bg-gray-900 text-gray-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 border border-gray-600"
                        autocomplete="off" maxlength="200">
                    <button id="search-close-btn" class="text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-700" aria-label="\uAC80\uC0C9 \uB2EB\uAE30">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="flex items-center gap-2 px-4 py-2 border-b border-gray-700/50 bg-gray-800/50">
                    <span class="text-xs text-gray-500 flex-shrink-0">\uD0DC\uADF8:</span>
                    <button data-tag="images" class="search-tag-btn flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors bg-gray-700/50 border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        #images
                    </button>
                    <button data-tag="files" class="search-tag-btn flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors bg-gray-700/50 border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-4.586 4.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.586a4 4 0 105.657 5.657l4.585-4.586"/>
                        </svg>
                        #files
                    </button>
                    <button data-tag="code" class="search-tag-btn flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors bg-gray-700/50 border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                        </svg>
                        #code
                    </button>
                    <button data-tag="url" class="search-tag-btn flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors bg-gray-700/50 border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                        </svg>
                        #url
                    </button>
                </div>
                <div id="search-results-container" class="flex-1 overflow-y-auto p-4 space-y-2" style="scrollbar-width: thin; scrollbar-color: #4B5563 transparent;">
                    <div class="flex flex-col items-center justify-center h-full text-gray-500">
                        <svg class="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        <p class="text-sm">\uAC80\uC0C9\uC5B4\uB97C \uC785\uB825\uD558\uC138\uC694</p>
                        <p class="text-xs text-gray-600 mt-1">\uCD5C\uADFC 12\uC2DC\uAC04 \uC774\uB0B4\uC758 \uBAA8\uB4E0 \uBA54\uC2DC\uC9C0\uC5D0\uC11C \uAC80\uC0C9\uD569\uB2C8\uB2E4</p>
                    </div>
                </div>
                <div id="search-result-count" class="hidden px-4 py-2 text-xs text-gray-400 border-t border-gray-700 bg-gray-800/50">
                </div>
            </div>
        `;
    document.body.appendChild(this.overlay);
    this.searchInput = this.overlay.querySelector("#search-input");
    this.resultsContainer = this.overlay.querySelector("#search-results-container");
    this.resultCountEl = this.overlay.querySelector("#search-result-count");
    this.overlay.querySelector("#search-close-btn").addEventListener("click", () => this.close());
    this.overlay.querySelectorAll(".search-tag-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.dataset.tag;
        this.toggleTag(tag);
      });
    });
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.addEventListener("keydown", this._searchKeyHandler = (e) => {
      if (e.key === "Escape" && this.isOpen) {
        const galleryOverlay = document.getElementById("gallery-overlay");
        const galleryLightbox = document.getElementById("gallery-lightbox");
        if (galleryOverlay && !galleryOverlay.classList.contains("hidden")) return;
        if (galleryLightbox && !galleryLightbox.classList.contains("hidden")) return;
        e.preventDefault();
        this.close();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        const active = document.activeElement;
        const isEditable = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
        if (!isEditable && !this.isOpen) {
          e.preventDefault();
          this.open();
        }
      }
    });
    this.searchInput.addEventListener("input", () => {
      this.syncTagsFromInput();
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.performSearch(), SEARCH_CLIENT.DEBOUNCE_MS);
    });
    this.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.performSearch();
      }
    });
  }
  toggleTag(tag) {
    if (this.activeTags.has(tag)) {
      this.activeTags.delete(tag);
    } else {
      this.activeTags.add(tag);
    }
    this.updateTagButtons();
    this.syncInputFromTags();
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.performSearch(), SEARCH_CLIENT.DEBOUNCE_MS);
  }
  updateTagButtons() {
    this.overlay.querySelectorAll(".search-tag-btn").forEach((btn) => {
      const tag = btn.dataset.tag;
      if (this.activeTags.has(tag)) {
        btn.classList.remove("bg-gray-700/50", "border-gray-600", "text-gray-400");
        btn.classList.add("bg-blue-600/30", "border-blue-500", "text-blue-300");
      } else {
        btn.classList.add("bg-gray-700/50", "border-gray-600", "text-gray-400");
        btn.classList.remove("bg-blue-600/30", "border-blue-500", "text-blue-300");
      }
    });
  }
  syncInputFromTags() {
    const parts = [];
    for (const tag of this.activeTags) {
      parts.push(`#${tag}`);
    }
    this.searchInput.value = parts.join(" ");
  }
  syncTagsFromInput() {
    const text = this.searchInput.value;
    const tagRegex = /#(images|files|code|url)\b/gi;
    const foundTags = /* @__PURE__ */ new Set();
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
      foundTags.add(match[1].toLowerCase());
    }
    this.activeTags = foundTags;
    this.updateTagButtons();
  }
  attachHeaderButton() {
    const headerRight = document.querySelector("header .flex.items-center.gap-3");
    if (!headerRight) return;
    const searchBtn = document.createElement("button");
    searchBtn.id = "search-toggle-btn";
    searchBtn.className = "text-gray-400 hover:text-gray-200 transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-gray-700";
    searchBtn.title = "\uBA54\uC2DC\uC9C0 \uAC80\uC0C9 (Ctrl+F)";
    searchBtn.setAttribute("aria-label", "\uBA54\uC2DC\uC9C0 \uAC80\uC0C9");
    searchBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
        `;
    searchBtn.addEventListener("click", () => this.open());
    const userCount = headerRight.querySelector("#user-count");
    if (userCount) {
      headerRight.insertBefore(searchBtn, userCount);
    } else {
      headerRight.appendChild(searchBtn);
    }
  }
  open() {
    this.isOpen = true;
    this.overlay.classList.remove("hidden");
    this.searchInput.focus();
    document.body.style.overflow = "hidden";
  }
  close() {
    this.isOpen = false;
    this.overlay.classList.add("hidden");
    document.body.style.overflow = "";
    this.searchInput.value = "";
    this.results = [];
    this.currentQuery = "";
    this.activeTags.clear();
    this.updateTagButtons();
    this.resetResults();
  }
  resetResults() {
    this.resultCountEl.classList.add("hidden");
    this.resultsContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-500">
                <svg class="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <p class="text-sm">\uAC80\uC0C9\uC5B4\uB97C \uC785\uB825\uD558\uC138\uC694</p>
                <p class="text-xs text-gray-600 mt-1">\uCD5C\uADFC 12\uC2DC\uAC04 \uC774\uB0B4\uC758 \uBAA8\uB4E0 \uBA54\uC2DC\uC9C0\uC5D0\uC11C \uAC80\uC0C9\uD569\uB2C8\uB2E4</p>
            </div>
        `;
  }
  async performSearch() {
    const query = this.searchInput.value.trim();
    if (!query) {
      this.resetResults();
      return;
    }
    this.currentQuery = query;
    this.resultsContainer.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="flex items-center gap-2 text-gray-400">
                    <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-sm">\uAC80\uC0C9 \uC911...</span>
                </div>
            </div>
        `;
    try {
      const params = new URLSearchParams({ q: query, limit: String(SEARCH_CLIENT.MAX_RESULTS) });
      const response = await fetch(`/api/search?${params}`);
      if (!response.ok) {
        throw new Error(`\uAC80\uC0C9 \uC2E4\uD328: ${response.status}`);
      }
      const data = await response.json();
      this.results = data.results || [];
      this.renderResults();
    } catch (error) {
      console.error("[Search] Error:", error);
      this.resultsContainer.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center">
                        <svg class="w-10 h-10 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <p class="text-sm text-red-400">\uAC80\uC0C9 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4</p>
                        <p class="text-xs text-gray-500 mt-1">${error.message}</p>
                    </div>
                </div>
            `;
    }
  }
  getQueryWithoutTags() {
    return this.currentQuery.replace(/#(images|files|code|url)\b/gi, "").trim();
  }
  highlightText(text) {
    const textTerms = this.getQueryWithoutTags();
    if (!text && !textTerms) return escapeHtml(text || "");
    const escaped = escapeHtml(text || "");
    if (!textTerms) return escaped;
    const terms = textTerms.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
    let result = escaped;
    for (const term of terms) {
      const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      result = result.replace(regex, '<mark class="bg-yellow-500/30 text-yellow-200 rounded px-0.5">$1</mark>');
    }
    return result;
  }
  renderTagBadges(tags) {
    if (!tags || tags.length === 0) return "";
    const tagConfig = {
      images: { label: "images", bg: "bg-emerald-600/30", text: "text-emerald-300", border: "border-emerald-500/40" },
      files: { label: "files", bg: "bg-amber-600/30", text: "text-amber-300", border: "border-amber-500/40" },
      code: { label: "code", bg: "bg-violet-600/30", text: "text-violet-300", border: "border-violet-500/40" },
      url: { label: "url", bg: "bg-sky-600/30", text: "text-sky-300", border: "border-sky-500/40" }
    };
    return tags.map((tag) => {
      const cfg = tagConfig[tag] || { label: tag, bg: "bg-gray-600/30", text: "text-gray-300", border: "border-gray-500/40" };
      return `<span class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${cfg.bg} ${cfg.text} border ${cfg.border}">#${cfg.label}</span>`;
    }).join(" ");
  }
  renderResults() {
    if (this.results.length === 0) {
      this.resultsContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-500">
                    <svg class="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-sm">"${escapeHtml(this.currentQuery)}"\uC5D0 \uB300\uD55C \uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</p>
                    <p class="text-xs text-gray-600 mt-1">\uB2E4\uB978 \uAC80\uC0C9\uC5B4\uB97C \uC2DC\uB3C4\uD574\uBCF4\uC138\uC694</p>
                </div>
            `;
      this.resultCountEl.classList.add("hidden");
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const msg of this.results) {
      const item = document.createElement("div");
      item.className = "p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 cursor-pointer transition-colors border border-gray-600/50";
      item.setAttribute("data-message-id", msg.messageId);
      const timestamp = new Date(msg.timestamp).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      const senderName = escapeHtml(msg.nickname || "Anonymous");
      const contentPreview = msg.content.length > SEARCH_CLIENT.RESULT_PREVIEW_LENGTH ? msg.content.substring(0, SEARCH_CLIENT.RESULT_PREVIEW_LENGTH) + "..." : msg.content;
      const highlightedContent = this.highlightText(contentPreview);
      let fileBadge = "";
      if (msg.hasFile) {
        const isImage = msg.fileType && msg.fileType.startsWith("image/");
        if (isImage) {
          fileBadge = `<span class="text-xs text-emerald-400 ml-1.5">
                        <svg class="w-3.5 h-3.5 inline-block mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>${escapeHtml(msg.fileName || "image")}</span>`;
        } else {
          fileBadge = `<span class="text-xs text-amber-400 ml-1.5">
                        <svg class="w-3.5 h-3.5 inline-block mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-4.586 4.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.586a4 4 0 105.657 5.657l4.585-4.586"/>
                        </svg>${escapeHtml(msg.fileName || "file")}</span>`;
        }
      }
      const tagBadges = this.renderTagBadges(msg.tags);
      item.innerHTML = `
                <div class="flex items-start justify-between gap-2 mb-1">
                    <div class="flex items-center flex-wrap gap-1">
                        <span class="text-xs font-medium text-blue-300">${senderName}</span>
                        ${fileBadge}
                    </div>
                    <span class="text-xs text-gray-500 flex-shrink-0">${timestamp}</span>
                </div>
                ${tagBadges ? `<div class="mb-1.5 flex flex-wrap gap-1">${tagBadges}</div>` : ""}
                <div class="text-sm text-gray-300 break-words leading-relaxed">${highlightedContent}</div>
            `;
      item.addEventListener("click", () => {
        if (this.onResultClick) {
          this.onResultClick(msg.messageId);
        }
        this.close();
      });
      fragment.appendChild(item);
    }
    this.resultsContainer.innerHTML = "";
    this.resultsContainer.appendChild(fragment);
    this.resultCountEl.textContent = `\uAC80\uC0C9 \uACB0\uACFC: ${this.results.length}\uAC74`;
    this.resultCountEl.classList.remove("hidden");
  }
};

// public/js/security-headers.js?v=1.0.1
var SecurityHeadersManager = class {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || null;
    this.overlay = null;
    this.createOverlay();
  }
  createOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.id = "security-headers-overlay";
    this.overlay.className = "fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm hidden";
    this.overlay.innerHTML = `
            <div class="fixed inset-0 md:inset-y-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-gray-800 shadow-2xl flex flex-col md:rounded-xl overflow-hidden border border-gray-700">
                <div class="flex items-center justify-between p-4 border-b border-gray-700">
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-2.332 9-7.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                        <h3 class="text-sm font-semibold text-gray-100">\uBCF4\uC548 \uD5E4\uB354 \uBD84\uC11D</h3>
                    </div>
                    <button id="sec-close-btn" class="text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-700" aria-label="\uB2EB\uAE30">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div id="sec-content" class="flex-1 overflow-y-auto p-4" style="scrollbar-width: thin; scrollbar-color: #4B5563 transparent;">
                </div>
            </div>
        `;
    document.body.appendChild(this.overlay);
    this.overlay.querySelector("#sec-close-btn").addEventListener("click", () => this.close());
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.overlay.classList.contains("hidden")) {
        e.preventDefault();
        this.close();
      }
    });
  }
  async analyze(url) {
    this.open();
    const content = this.overlay.querySelector("#sec-content");
    content.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="flex items-center gap-2 text-gray-400">
                    <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-sm">\uBD84\uC11D \uC911...</span>
                </div>
            </div>
        `;
    try {
      if (!this.apiUrl) {
        throw new Error("Security headers API not configured");
      }
      const apiUrl = `${this.apiUrl}/security/headers?url=${encodeURIComponent(url)}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      this.renderResult(data, url);
    } catch (error) {
      console.error("[SecurityHeaders] Error:", error);
      content.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center">
                        <svg class="w-10 h-10 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <p class="text-sm text-red-400">\uBCF4\uC548 \uD5E4\uB354 \uBD84\uC11D \uC2E4\uD328</p>
                        <p class="text-xs text-gray-500 mt-1">${this.esc(error.message)}</p>
                    </div>
                </div>
            `;
    }
  }
  renderResult(data, url) {
    const content = this.overlay.querySelector("#sec-content");
    const numericScore = typeof data.score === "number" ? data.score : typeof data.grade === "number" ? data.grade : 0;
    const letterGrade = typeof data.grade === "string" ? data.grade : typeof data.score === "string" ? data.score : "";
    const scoreColor = this.getScoreColor(numericScore);
    let headersHtml = "";
    const headerNames = {
      "Content-Security-Policy": "CSP",
      "Strict-Transport-Security": "HSTS",
      "X-Frame-Options": "X-Frame",
      "X-Content-Type-Options": "X-Content-Type",
      "Referrer-Policy": "Referrer",
      "Permissions-Policy": "Permissions",
      "Cross-Origin-Embedder-Policy": "COEP",
      "Cross-Origin-Opener-Policy": "COOP",
      "Cross-Origin-Resource-Policy": "CORP",
      "Server": "Server",
      "X-Powered-By": "X-Powered-By"
    };
    for (const [key, value] of Object.entries(data.headers || {})) {
      const label = headerNames[key] || key;
      const badge = value ? '<span class="text-emerald-400">\uC124\uC815\uB428</span>' : '<span class="text-red-400">\uBBF8\uC124\uC815</span>';
      headersHtml += `
                <div class="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                    <span class="text-xs text-gray-300 font-medium">${this.esc(label)}</span>
                    ${badge}
                </div>
            `;
    }
    let analysisHtml = "";
    if (data.analysis && data.analysis.length > 0) {
      for (const item of data.analysis) {
        const statusConfig = {
          excellent: { bg: "bg-emerald-600/30", text: "text-emerald-300", label: "\uC6B0\uC218" },
          good: { bg: "bg-blue-600/30", text: "text-blue-300", label: "\uC591\uD638" },
          warning: { bg: "bg-amber-600/30", text: "text-amber-300", label: "\uC8FC\uC758" },
          danger: { bg: "bg-red-600/30", text: "text-red-300", label: "\uC704\uD5D8" },
          info: { bg: "bg-gray-600/30", text: "text-gray-300", label: "\uC815\uBCF4" }
        };
        const cfg = statusConfig[item.status] || statusConfig.info;
        analysisHtml += `
                    <div class="py-2 border-b border-gray-700/50 last:border-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}">${cfg.label}</span>
                            <span class="text-xs text-gray-200 font-medium">${this.esc(item.header)}</span>
                        </div>
                        <p class="text-xs text-gray-400 leading-relaxed">${this.esc(item.message)}</p>
                    </div>
                `;
      }
    }
    content.innerHTML = `
            <div class="space-y-4">
                <div class="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex-1 min-w-0 mr-3">
                            <p class="text-xs text-gray-400 mb-1">\uBD84\uC11D \uB300\uC0C1</p>
                            <p class="text-sm text-gray-200 break-all truncate" title="${this.esc(url)}">${this.esc(this.truncateUrl(url))}</p>
                        </div>
                        <div class="text-center flex-shrink-0">
                            <div class="w-14 h-14 rounded-full flex items-center justify-center border-2 ${scoreColor.border} mb-1">
                                <span class="text-xl font-bold ${scoreColor.text}">${this.esc(letterGrade || String(numericScore))}</span>
                            </div>
                            <span class="text-[10px] text-gray-400">${numericScore}/100</span>
                        </div>
                    </div>
                    <div class="w-full bg-gray-600 rounded-full h-2">
                        <div class="h-2 rounded-full transition-all duration-500 ${scoreColor.bg}" style="width: ${numericScore}%"></div>
                    </div>
                </div>

                <div>
                    <h4 class="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                        \uD5E4\uB354 \uC0C1\uD0DC
                    </h4>
                    <div class="bg-gray-700/30 rounded-lg p-3 border border-gray-700/50">
                        ${headersHtml}
                    </div>
                </div>

                ${analysisHtml ? `
                <div>
                    <h4 class="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        \uC0C1\uC138 \uBD84\uC11D
                    </h4>
                    <div class="bg-gray-700/30 rounded-lg p-3 border border-gray-700/50">
                        ${analysisHtml}
                    </div>
                </div>
                ` : ""}

                <div class="bg-amber-900/20 rounded-lg p-3 border border-amber-700/30">
                    <p class="text-[11px] text-amber-300/70 leading-relaxed">\uBCF8 \uBD84\uC11D\uC740 \uAC1C\uBC1C \uC911\uC778 API\uB97C \uC0AC\uC6A9\uD558\uBA70, \uC77C\uBD80 \uC0AC\uC774\uD2B8\uB294 \uBCF4\uC548 \uD5E4\uB354 \uAC80\uC99D\uC774 \uBD88\uAC00\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uACB0\uACFC\uC758 \uC2E0\uB8B0\uC131\uC774 \uB5A8\uC5B4\uC9C8 \uC218 \uC788\uC73C\uB2C8 \uCC38\uACE0\uC6A9\uC73C\uB85C\uB9CC \uD65C\uC6A9\uD574\uC8FC\uC138\uC694.</p>
                </div>
            </div>
        `;
  }
  getScoreColor(score) {
    if (score >= 90) return { bg: "bg-emerald-500", text: "text-emerald-300", border: "border-emerald-500" };
    if (score >= 70) return { bg: "bg-blue-500", text: "text-blue-300", border: "border-blue-500" };
    if (score >= 50) return { bg: "bg-amber-500", text: "text-amber-300", border: "border-amber-500" };
    return { bg: "bg-red-500", text: "text-red-300", border: "border-red-500" };
  }
  truncateUrl(url) {
    if (url.length > 60) return url.substring(0, 57) + "...";
    return url;
  }
  esc(text) {
    return escapeHtml(text);
  }
  open() {
    this.overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  close() {
    this.overlay.classList.add("hidden");
    document.body.style.overflow = "";
  }
};

// public/js/turnstile.js?v=1.0.0
var TurnstileManager = class {
  constructor(siteKey, onVerified) {
    this.siteKey = siteKey;
    this.onVerified = onVerified;
    this.verified = false;
    this.widgetId = null;
    this.STORAGE_KEY = "turnstileVerified";
    this.SESSION_TIMESTAMP_KEY = "turnstileVerifiedAt";
    this.MAX_SESSION_AGE = TURNSTILE_CLIENT.SESSION_AGE_MS;
  }
  isAlreadyVerified() {
    const verified = sessionStorage.getItem(this.STORAGE_KEY);
    const timestamp = sessionStorage.getItem(this.SESSION_TIMESTAMP_KEY);
    if (verified === "true" && timestamp) {
      const elapsed = Date.now() - parseInt(timestamp, 10);
      if (elapsed < this.MAX_SESSION_AGE) {
        return true;
      }
      sessionStorage.removeItem(this.STORAGE_KEY);
      sessionStorage.removeItem(this.SESSION_TIMESTAMP_KEY);
    }
    return false;
  }
  markVerified() {
    this.verified = true;
    sessionStorage.setItem(this.STORAGE_KEY, "true");
    sessionStorage.setItem(this.SESSION_TIMESTAMP_KEY, String(Date.now()));
  }
  init() {
    if (this.isAlreadyVerified()) {
      this.verified = true;
      this.hideModal();
      if (this.onVerified) this.onVerified();
      return;
    }
    this.showModal();
    this.renderWidget();
  }
  showModal() {
    const modal = document.getElementById("turnstile-modal");
    if (modal) {
      modal.classList.remove("opacity-0", "pointer-events-none");
      modal.classList.add("opacity-100");
      const inner = modal.querySelector(".scale-95");
      if (inner) {
        inner.classList.remove("scale-95");
        inner.classList.add("scale-100");
      }
    }
  }
  hideModal() {
    const modal = document.getElementById("turnstile-modal");
    if (modal) {
      modal.classList.add("opacity-0", "pointer-events-none");
      modal.classList.remove("opacity-100");
      const inner = modal.querySelector(".scale-100");
      if (inner) {
        inner.classList.remove("scale-100");
        inner.classList.add("scale-95");
      }
    }
  }
  showSuccess() {
    const container = document.getElementById("turnstile-widget");
    const successEl = document.getElementById("turnstile-success");
    const errorEl = document.getElementById("turnstile-error");
    if (container) container.classList.add("hidden");
    if (errorEl) errorEl.classList.add("hidden");
    if (successEl) successEl.classList.remove("hidden");
    setTimeout(() => {
      this.hideModal();
      if (this.onVerified) this.onVerified();
    }, TURNSTILE_CLIENT.HIDE_DELAY_MS);
  }
  showError(message) {
    const errorEl = document.getElementById("turnstile-error");
    if (errorEl) {
      errorEl.textContent = message || "\uC778\uC99D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.";
      errorEl.classList.remove("hidden");
    }
  }
  hideError() {
    const errorEl = document.getElementById("turnstile-error");
    if (errorEl) errorEl.classList.add("hidden");
  }
  renderWidget() {
    const container = document.getElementById("turnstile-widget");
    if (!container) return;
    if (typeof turnstile !== "undefined") {
      this.widgetId = turnstile.render(container, {
        sitekey: this.siteKey,
        theme: "dark",
        size: "normal",
        callback: (token) => this.handleCallback(token),
        "error-callback": () => this.handleError(),
        "expired-callback": () => this.handleExpired(),
        "timeout-callback": () => this.handleExpired()
      });
    } else {
      this.showError("\uBCF4\uC548 \uC778\uC99D \uB85C\uB529 \uC911...");
      let attempts = 0;
      const maxAttempts = TURNSTILE_CLIENT.POLL_MAX_ATTEMPTS;
      const waitInterval = setInterval(() => {
        attempts++;
        if (typeof turnstile !== "undefined") {
          clearInterval(waitInterval);
          this.hideError();
          this.widgetId = turnstile.render(container, {
            sitekey: this.siteKey,
            theme: "dark",
            size: "normal",
            callback: (token) => this.handleCallback(token),
            "error-callback": () => this.handleError(),
            "expired-callback": () => this.handleExpired(),
            "timeout-callback": () => this.handleExpired()
          });
        } else if (attempts >= maxAttempts) {
          clearInterval(waitInterval);
          this.showError("\uBCF4\uC548 \uC778\uC99D \uB85C\uB529 \uC2E4\uD328. \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD574\uC8FC\uC138\uC694.");
        }
      }, TURNSTILE_CLIENT.POLL_INTERVAL_MS);
    }
  }
  async handleCallback(token) {
    this.hideError();
    try {
      const response = await fetch("/api/turnstile/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const result = await response.json();
      if (result.success) {
        this.markVerified();
        this.showSuccess();
      } else {
        const errorMsg = result.errorCodes && result.errorCodes.includes("timeout-or-duplicate") ? "\uC778\uC99D \uC2DC\uAC04\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694." : "\uC778\uC99D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.";
        this.showError(errorMsg);
        this.resetWidget();
      }
    } catch (error) {
      console.error("Turnstile verify request failed:", error);
      this.showError("\uC11C\uBC84 \uD1B5\uC2E0 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.");
      this.resetWidget();
    }
  }
  handleError() {
    this.showError("\uBCF4\uC548 \uC778\uC99D\uC5D0 \uBB38\uC81C\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD574\uC8FC\uC138\uC694.");
  }
  handleExpired() {
    this.showError("\uC778\uC99D\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC778\uC99D\uD574\uC8FC\uC138\uC694.");
    this.resetWidget();
  }
  resetWidget() {
    if (typeof turnstile !== "undefined" && this.widgetId) {
      turnstile.reset(this.widgetId);
    }
  }
};

// public/js/og-preview.js?v=1.0.0
var CACHE_MAX = OG_PREVIEW_CLIENT.CACHE_SIZE;
var FETCH_TIMEOUT = OG_PREVIEW_CLIENT.FETCH_TIMEOUT_MS;
var OGPreviewManager = class {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
    this.pendingFetches = /* @__PURE__ */ new Map();
  }
  async getPreview(url) {
    const cached = this.cache.get(url);
    if (cached) return cached;
    if (this.pendingFetches.has(url)) {
      return this.pendingFetches.get(url);
    }
    const promise = this._fetchPreview(url);
    this.pendingFetches.set(url, promise);
    const result = await promise;
    this.pendingFetches.delete(url);
    if (result) {
      if (this.cache.size >= CACHE_MAX) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(url, result);
    }
    return result;
  }
  async _fetchPreview(url) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const response = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.og) return null;
      const og = data.og;
      if (!og.title && !og.description && !og.image) return null;
      return og;
    } catch (_e) {
      return null;
    }
  }
  renderCard(og, url) {
    const title = this._esc(og.title || new URL(url).hostname);
    const description = og.description ? this._esc(og.description.substring(0, OG_PREVIEW_CLIENT.TRUNCATION_LENGTH)) : "";
    const image = og.image || "";
    const siteName = og.siteName ? this._esc(og.siteName) : this._esc(new URL(url).hostname);
    return `
            <div class="og-card mt-2 rounded-lg border border-gray-600/50 overflow-hidden bg-gray-800/60 hover:bg-gray-700/60 transition-colors cursor-pointer" onclick="window.open('${this._esc(url)}', '_blank', 'noopener')">
                ${image ? `
                <div class="og-image w-full h-40 bg-gray-700 overflow-hidden flex items-center justify-center">
                    <img src="${this._esc(image)}" alt="" class="w-full h-full object-cover" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'text-gray-500 text-xs\\'>\uC774\uBBF8\uC9C0\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4</div>'">
                </div>` : ""}
                <div class="p-3">
                    <p class="text-sm font-semibold text-gray-100 leading-snug" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${title}</p>
                    ${description ? `<p class="text-xs text-gray-400 mt-1 leading-relaxed" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${description}</p>` : ""}
                    <p class="text-xs text-gray-500 mt-1.5 truncate">${siteName}</p>
                </div>
            </div>
        `;
  }
  _ogId(url) {
    let safe = "";
    for (let i = 0; i < url.length; i++) {
      const c = url.charCodeAt(i);
      safe += c >= 97 && c <= 122 || c >= 48 && c <= 57 || c === 58 || c === 47 || c === 46 || c === 45 || c === 95 ? url[i] : "_";
    }
    return "og_" + safe.substring(0, OG_PREVIEW_CLIENT.ID_PREFIX_LENGTH);
  }
  enrichUrlLink(aElement) {
    const url = aElement.href;
    if (!url || !url.startsWith("http")) return;
    if (aElement.closest(".og-card") || aElement.closest(".og-image")) return;
    if (aElement.closest("[data-og-enriched]")) return;
    const parent = aElement.parentElement;
    if (parent && parent.closest?.(".og-card")) return;
    if (aElement.querySelector("img")) return;
    const container = aElement.closest("[data-message]") || aElement.closest(".message-content");
    if (!container) return;
    const ogId = this._ogId(url);
    if (container.querySelector(`[data-og-id="${ogId}"]`)) return;
    const placeholder = document.createElement("div");
    placeholder.dataset.ogEnriched = "true";
    placeholder.dataset.ogId = ogId;
    placeholder.className = "og-placeholder";
    placeholder.innerHTML = '<div class="flex items-center gap-2 mt-2 text-gray-500 text-xs"><div class="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>\uB9C1\uD06C \uBBF8\uB9AC\uBCF4\uAE30 \uB85C\uB529 \uC911...</div>';
    const linkEl = aElement.closest(".inline-flex") || aElement.parentElement;
    if (linkEl) {
      linkEl.insertAdjacentElement("afterend", placeholder);
    } else {
      aElement.insertAdjacentElement("afterend", placeholder);
    }
    this.getPreview(url).then((og) => {
      if (og) {
        placeholder.innerHTML = this.renderCard(og, url);
      } else {
        placeholder.remove();
      }
    }).catch(() => {
      placeholder.remove();
    });
  }
  async enrichMessage(element) {
    if (!element) return;
    const links = element.querySelectorAll('a[href^="http"]');
    for (const link of links) {
      this.enrichUrlLink(link);
      await new Promise((r) => setTimeout(r, OG_PREVIEW_CLIENT.RATE_LIMIT_DELAY_MS));
    }
  }
  _esc(text) {
    return escapeHtml(text);
  }
};

// public/js/theme.js?v=1.0.0
var THEMES = ["dark", "light", "midnight", "ocean", "forest", "amethyst", "sunset", "sakura"];
var META_COLORS = { dark: "#1F2937", light: "#FFFFFF", midnight: "#1E293B", ocean: "#134E4A", forest: "#14532D", amethyst: "#1A0A2E", sunset: "#292524", sakura: "#FFF5F7" };
var ThemeManager = class {
  constructor() {
    this.options = document.querySelectorAll(".theme-option");
    this.meta = document.getElementById("theme-color-meta");
    this.current = this.load();
    this.apply(this.current);
    this.bindEvents();
  }
  load() {
    try {
      const saved = localStorage.getItem("chatTheme");
      if (saved && THEMES.includes(saved)) return saved;
    } catch (_e) {
    }
    return "dark";
  }
  save(theme) {
    try {
      localStorage.setItem("chatTheme", theme);
    } catch (_e) {
    }
  }
  apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (this.meta && META_COLORS[theme]) {
      this.meta.setAttribute("content", META_COLORS[theme]);
    }
    this.current = theme;
    this.highlightActive();
  }
  setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    this.apply(theme);
    this.save(theme);
  }
  highlightActive() {
    this.options.forEach((opt) => {
      opt.classList.remove("active");
      const existingCheck = opt.querySelector(".theme-check");
      if (existingCheck) existingCheck.remove();
      if (opt.dataset.themeValue === this.current) {
        opt.classList.add("active");
        opt.style.fontWeight = "600";
        const check = document.createElement("span");
        check.className = "theme-check ml-auto text-blue-400 text-xs";
        check.innerHTML = "&#10003;";
        opt.appendChild(check);
      } else {
        opt.style.fontWeight = "";
      }
    });
  }
  bindEvents() {
    this.options.forEach((opt) => {
      opt.addEventListener("click", () => {
        this.setTheme(opt.dataset.themeValue);
      });
    });
  }
};

// public/js/chat.js
var ChatClient = class {
  constructor(config = {}) {
    this.sessionManager = new SessionManager();
    this.ui = new UIManager();
    this.fileUpload = new FileUploadManager(config.fileUploadUrl || null, "/api/upload");
    this.deadDrop = new DeadDropClient();
    this.typingTimeout = null;
    this.lastMessageTime = 0;
    this.messageRateLimit = RATE_LIMIT.MESSAGE_COOLDOWN;
    this.isTyping = false;
    this.isNicknameLocked = true;
    this.unreadCount = 0;
    this.originalTitle = document.title;
    this.titleBlinkInterval = null;
    this.typingUsers = /* @__PURE__ */ new Map();
    this.announcementHistoryBtn = document.getElementById("announcement-history-btn");
    this.announcementNewBadge = document.getElementById("announcement-new-badge");
    this.announcementTooltip = document.getElementById("announcement-tooltip");
    this.latestAnnouncementTimestamp = 0;
    this.announcementSeenStorageKey = "chatLastSeenAnnouncementTs";
    this.currentChannel = "0";
    this.currentChannelName = "";
    this._messageHistory = [];
    this._historyIndex = -1;
    this._historySavedInput = "";
    try {
      const savedChannel = localStorage.getItem("chatCurrentChannel");
      if (savedChannel && savedChannel !== "0") {
        this.currentChannel = savedChannel;
        this.currentChannelName = localStorage.getItem("chatCurrentChannelName") || "";
      }
    } catch (_e) {
    }
    this.wsManager = new WebSocketManager(
      this.sessionManager.getSessionId(),
      {
        onMessage: (data) => this.handleMessage(data),
        onConnectionChange: (status, attempt, max) => this.handleConnectionChange(status, attempt, max),
        onError: (message) => this.ui.displayError(message)
      }
    );
    this.wsManager.channelId = this.currentChannel;
    this.pushManager = new PushNotificationManager();
    this.search = new SearchManager((messageId) => this.scrollToMessage(messageId));
    this.securityHeaders = new SecurityHeadersManager(config.kalphaApiUrl || null);
    this.ogPreview = new OGPreviewManager();
    this.theme = new ThemeManager();
    window.chatClient = this;
    this.initializeUI();
    this.initializeCommandPopup();
    this.initializeAnnouncementIndicator();
    this.turnstile = new TurnstileManager(config.turnstileSiteKey, () => this.onTurnstileVerified());
    this.turnstile.init();
  }
  onTurnstileVerified() {
    this.wsManager.connect();
    this.initializePush();
  }
  toTimestamp(value) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }
  getSeenAnnouncementTimestamp() {
    try {
      const stored = localStorage.getItem(this.announcementSeenStorageKey);
      const ts = Number(stored);
      return Number.isFinite(ts) && ts > 0 ? ts : 0;
    } catch (_e) {
      return 0;
    }
  }
  setSeenAnnouncementTimestamp(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return;
    }
    try {
      localStorage.setItem(this.announcementSeenStorageKey, String(Math.floor(timestamp)));
    } catch (_e) {
    }
  }
  showAnnouncementBadge() {
    if (this.announcementNewBadge) {
      this.announcementNewBadge.classList.remove("hidden");
    }
    if (this.announcementTooltip) {
      this.announcementTooltip.classList.remove("hidden");
    }
  }
  hideAnnouncementBadge() {
    if (this.announcementNewBadge) {
      this.announcementNewBadge.classList.add("hidden");
    }
    if (this.announcementTooltip) {
      this.announcementTooltip.classList.add("hidden");
    }
  }
  updateAnnouncementBadgeVisibility() {
    const seenTs = this.getSeenAnnouncementTimestamp();
    if (this.latestAnnouncementTimestamp > seenTs) {
      this.showAnnouncementBadge();
    } else {
      this.hideAnnouncementBadge();
    }
  }
  // Add click listener to tooltip as well
  async initializeAnnouncementIndicator() {
    const markAsSeen = () => {
      const timestampToMark = this.latestAnnouncementTimestamp || Date.now();
      this.setSeenAnnouncementTimestamp(timestampToMark);
      this.hideAnnouncementBadge();
    };
    if (this.announcementHistoryBtn) {
      this.announcementHistoryBtn.addEventListener("click", markAsSeen);
    }
    if (this.announcementTooltip) {
      this.announcementTooltip.addEventListener("click", () => {
        markAsSeen();
        window.location.href = "/announcements.html";
      });
    }
    try {
      const announcements = await api_client_default.get("/api/announcements").catch(() => []);
      if (!Array.isArray(announcements) || announcements.length === 0) {
        return;
      }
      this.latestAnnouncementTimestamp = announcements.reduce((latest, item) => {
        const ts = this.toTimestamp(item?.timestamp);
        return Math.max(latest, ts);
      }, 0);
      this.updateAnnouncementBadgeVisibility();
    } catch (error) {
      console.error("Failed to initialize announcement indicator:", error);
    }
  }
  async initializePush() {
    const result = await this.pushManager.initialize();
    const bellBtn = document.getElementById("notification-toggle");
    if (!result.supported || !bellBtn) {
      if (result.error) {
        if (result.error.includes("not configured")) {
          console.warn("[Push] Server push notifications not configured. Contact administrator.");
        }
      }
      return;
    }
    bellBtn.classList.remove("hidden");
    this.updateBellIcon(bellBtn);
    if (Notification.permission === "granted" && !result.subscribed && this.pushManager._sessionSubscribed) {
      const resubscribed = await this.pushManager.subscribe(this.sessionManager.getSessionId());
      if (resubscribed) {
        this.updateBellIcon(bellBtn);
      }
    }
    bellBtn.addEventListener("click", async () => {
      try {
        const success = await this.pushManager.toggle(this.sessionManager.getSessionId());
        if (success !== void 0) {
          this.updateBellIcon(bellBtn);
        } else {
          console.error("[Chat] Notification toggle returned undefined");
          this.ui.displayError("\uC54C\uB9BC \uC124\uC815\uC744 \uBCC0\uACBD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uBE0C\uB77C\uC6B0\uC800 \uAD8C\uD55C\uC744 \uD655\uC778\uD558\uAC70\uB098 \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68 \uD574\uC8FC\uC138\uC694.");
        }
      } catch (error) {
        console.error("[Chat] Notification toggle error:", error);
        this.ui.displayError("\uC54C\uB9BC \uC124\uC815 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4: " + error.message);
      }
    });
  }
  updateBellIcon(btn) {
    if (this.pushManager.isSubscribed) {
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';
      btn.title = "\uC54C\uB9BC \uB044\uAE30";
      btn.classList.add("text-yellow-400");
      btn.classList.remove("text-gray-400");
    } else {
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>';
      btn.title = "\uC54C\uB9BC \uCF1C\uAE30";
      btn.classList.remove("text-yellow-400");
      btn.classList.add("text-gray-400");
    }
  }
  initializeUI() {
    this.ui.initializeEventListeners({
      onSubmit: (e) => this.handleSubmit(e),
      onInput: () => this.handleInput(),
      onTyping: () => this.handleTyping(),
      onScrollClick: () => this.ui.scrollToBottom(true),
      onScroll: () => this.ui.updateScrollButton(),
      onDelete: (messageId) => this.deleteMessage(messageId),
      onRevealSecret: (secretId, container) => this.revealSecretMessage(secretId, container),
      onSetNickname: (newName) => this.handleSetNickname(newName),
      onToggleNicknameLock: () => this.handleToggleNicknameLock(),
      onAcceptNotice: (dontShowAgain) => this.handleAcceptNotice(dontShowAgain),
      onCreateChannel: (name) => this.createChannel(name),
      onJoinChannel: (number) => this.joinChannel(number),
      onBackToMain: () => this.switchChannel("0"),
      onReaction: (messageId, emoji, hasReacted) => this.sendReaction(messageId, emoji, hasReacted)
    });
    this.ui.updateNicknameDisplay(this.sessionManager.getNickname());
    this.ui.setNicknameLockState(this.isNicknameLocked);
    this.ui.updateChannelIndicator(this.currentChannel, this.currentChannelName);
  }
  handleSetNickname(newName) {
    const savedName = this.sessionManager.setNickname(newName);
    this.ui.updateNicknameDisplay(savedName);
  }
  handleToggleNicknameLock() {
    if (this.isNicknameLocked) {
      if (this.sessionManager.hasAcceptedNicknameNotice()) {
        this.isNicknameLocked = false;
        this.ui.setNicknameLockState(this.isNicknameLocked);
      } else {
        this.ui.showNoticeModal();
      }
    } else {
      this.isNicknameLocked = true;
      this.ui.setNicknameLockState(this.isNicknameLocked);
      if (this.ui.nicknameInput) {
        this.handleSetNickname(this.ui.nicknameInput.value);
      }
    }
  }
  handleAcceptNotice(dontShowAgain) {
    if (dontShowAgain) {
      this.sessionManager.setNicknameNoticeAccepted(true);
    }
    this.isNicknameLocked = false;
    this.ui.setNicknameLockState(this.isNicknameLocked);
  }
  handleMessage(data) {
    switch (data.type) {
      case "history":
        if (data.messages && data.messages.length > 0) {
          this.ui.displayBatchMessages(data.messages, this.sessionManager.getSessionId());
          this.ui.scrollToBottom();
          if (this.ogPreview) {
            this.ogPreview.enrichMessage(this.ui.messagesContainer);
          }
        }
        break;
      case "message":
        this.ui.displayMessage(
          data,
          data.sessionId === this.sessionManager.getSessionId(),
          this.sessionManager.getSessionId()
        );
        if (this.ogPreview) {
          const lastMsg = this.ui.messagesContainer.querySelector("[data-message]:last-child");
          if (lastMsg) this.ogPreview.enrichMessage(lastMsg);
        }
        if (document.hidden) {
          this.unreadCount++;
          this.updateUnreadTitle();
        }
        break;
      case "message_edited":
        this.ui.updateMessage(data.message.messageId, data.message.content, data.message.editedAt);
        break;
      case "message_deleted":
        this.ui.removeMessage(data.messageId);
        break;
      case "message_reaction":
        this.ui.updateReaction(data.messageId, data.emoji, data.count, data.reactionSessions, this.sessionManager.getSessionId());
        break;
      case "all_messages_deleted":
        this.ui.clearAllMessages();
        this.ui.displaySystemMessage("\uAD00\uB9AC\uC790\uAC00 \uBAA8\uB4E0 \uBA54\uC2DC\uC9C0\uB97C \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4.");
        break;
      case "user_count":
        this.ui.updateUserCount(data.count);
        break;
      case "typing":
        if (data.sessionId !== this.sessionManager.getSessionId()) {
          this.handleTypingEvent(data.sessionId, data.nickname, data.typing);
        }
        break;
      case "channel_deleted":
        this.ui.displaySystemMessage(data.content);
        this.switchChannel("0");
        break;
      case "system":
        this.ui.displaySystemMessage(data.content);
        break;
      case "summary":
        this.ui.displaySummary(data.content, data.messageId, data.summaryMode);
        break;
      case "announcement":
        this.latestAnnouncementTimestamp = Math.max(
          this.latestAnnouncementTimestamp,
          this.toTimestamp(data.timestamp)
        );
        this.ui.displayAnnouncement(data.content, data.timestamp);
        this.updateAnnouncementBadgeVisibility();
        if (data.isEmergency) {
          const seenTs = localStorage.getItem("chatEmergencySeenTs");
          if (String(data.timestamp) !== seenTs) {
            localStorage.setItem("chatEmergencySeenTs", String(data.timestamp));
            localStorage.setItem("chatEmergencyRedirectTime", String(Date.now()));
            location.href = "/announcements.html?from=emergency";
          }
        }
        break;
      case "emergency_cleared": {
        localStorage.removeItem("chatEmergencySeenTs");
        localStorage.removeItem("chatEmergencyRedirectTime");
        const toast = document.createElement("div");
        toast.className = "fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-800 text-green-100 px-4 py-2 rounded-lg shadow-lg text-sm transition-opacity duration-500";
        toast.textContent = "\uAE34\uAE09 \uACF5\uC9C0\uAC00 \uD574\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
        document.body.appendChild(toast);
        setTimeout(() => {
          toast.style.opacity = "0";
          setTimeout(() => toast.remove(), UI.TOAST_FADE_MS);
        }, UI.TOAST_DURATION_MS);
        break;
      }
      case "kicked": {
        const banDuration = data.banDuration || 0;
        const isPermanent = data.permanent === true;
        const isSessionBan = data.sessionBan === true;
        if (isPermanent && banDuration > 0) {
          const minutes = Math.floor(banDuration / 60);
          const seconds = banDuration % 60;
          const timeStr = minutes > 0 ? `${minutes}\uBD84 ${seconds}\uCD08` : `${seconds}\uCD08`;
          this.ui.displayError(`${data.content}
\uC7AC\uC811\uC18D\uC740 ${timeStr} \uD6C4 \uAC00\uB2A5\uD569\uB2C8\uB2E4.`);
          this.ui.setInputEnabled(false);
          if (isSessionBan) {
          } else {
            localStorage.removeItem("chatSessionId");
          }
          if (this.wsManager) {
            this.wsManager.manualClose = true;
            this.wsManager.disconnect();
          }
          alert(`\uAD00\uB9AC\uC790\uC5D0 \uC758\uD574 ${timeStr}\uAC04 \uCC28\uB2E8\uB418\uC5C8\uC2B5\uB2C8\uB2E4.

\uCC28\uB2E8\uC774 \uD574\uC81C\uB420 \uB54C\uAE4C\uC9C0 \uC811\uC18D\uC774 \uBD88\uAC00\uB2A5\uD569\uB2C8\uB2E4.
\uCC28\uB2E8 \uC2DC\uAC04\uC774 \uC9C0\uB09C \uD6C4 \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD558\uC5EC \uC7AC\uC811\uC18D\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`);
        } else if (banDuration > 0) {
          const minutes = Math.floor(banDuration / 60);
          const seconds = banDuration % 60;
          const timeStr = minutes > 0 ? `${minutes}\uBD84 ${seconds}\uCD08` : `${seconds}\uCD08`;
          this.ui.displayError(`${data.content}
\uC7AC\uC811\uC18D\uC740 ${timeStr} \uD6C4 \uAC00\uB2A5\uD569\uB2C8\uB2E4.`);
          alert(`\uAD00\uB9AC\uC790\uC5D0 \uC758\uD574 ${timeStr}\uAC04 \uCC28\uB2E8\uB418\uC5C8\uC2B5\uB2C8\uB2E4.
\uD398\uC774\uC9C0\uAC00 \uC0C8\uB85C\uACE0\uCE68\uB429\uB2C8\uB2E4.`);
          setTimeout(() => {
            window.location.reload();
          }, 2e3);
        } else {
          this.ui.displayError(data.content);
          alert("\uAD00\uB9AC\uC790\uC5D0 \uC758\uD574 \uAC15\uC81C\uD1F4\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uD398\uC774\uC9C0\uAC00 \uC0C8\uB85C\uACE0\uCE68\uB429\uB2C8\uB2E4.");
          setTimeout(() => {
            window.location.reload();
          }, UI.HIGHLIGHT_RING_MS);
        }
        break;
      }
      case "banned": {
        this.ui.displayError(data.content);
        this.ui.setInputEnabled(false);
        localStorage.removeItem("chatSessionId");
        if (this.wsManager) {
          this.wsManager.disconnect();
        }
        const remainingTime = data.remainingSeconds || 0;
        if (remainingTime > 0) {
          const mins = Math.floor(remainingTime / 60);
          const secs = remainingTime % 60;
          const timeText = mins > 0 ? `${mins}\uBD84 ${secs}\uCD08` : `${secs}\uCD08`;
          alert(`\uC811\uC18D\uC774 \uCC28\uB2E8\uB418\uC5C8\uC2B5\uB2C8\uB2E4.
\uCC28\uB2E8 \uD574\uC81C\uAE4C\uC9C0 ${timeText} \uB0A8\uC558\uC2B5\uB2C8\uB2E4.

\uCC28\uB2E8 \uC2DC\uAC04\uC774 \uC9C0\uB09C \uD6C4 \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD558\uC5EC \uC7AC\uC811\uC18D\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`);
        }
        break;
      }
      case "error":
        this.ui.displayError(data.content);
        break;
      default:
        break;
    }
  }
  handleTypingEvent(sessionId, nickname, isTyping) {
    const existing = this.typingUsers.get(sessionId);
    if (existing) {
      clearTimeout(existing.timeout);
    }
    if (isTyping) {
      const timeout = setTimeout(() => {
        this.typingUsers.delete(sessionId);
        this.ui.updateTypingIndicator(this.typingUsers);
      }, UI.TYPING_EXPIRY_MS);
      this.typingUsers.set(sessionId, { nickname: nickname || "\uC775\uBA85", timeout });
    } else {
      this.typingUsers.delete(sessionId);
    }
    this.ui.updateTypingIndicator(this.typingUsers);
  }
  updateUnreadTitle() {
    if (this.titleBlinkInterval) clearInterval(this.titleBlinkInterval);
    let showCount = true;
    const update = () => {
      document.title = showCount ? `(${this.unreadCount}) ${this.originalTitle}` : this.originalTitle;
      showCount = !showCount;
    };
    update();
    this.titleBlinkInterval = setInterval(update, UI.TITLE_BLINK_MS);
  }
  clearUnreadTitle() {
    if (this.titleBlinkInterval) {
      clearInterval(this.titleBlinkInterval);
      this.titleBlinkInterval = null;
    }
    this.unreadCount = 0;
    document.title = this.originalTitle;
  }
  handleConnectionChange(status, attempt, max) {
    let statusText = "";
    switch (status) {
      case "connected":
        statusText = "\uC5F0\uACB0\uB428";
        this.ui.setInputEnabled(true);
        this.ui.messageInput.focus();
        break;
      case "disconnected":
        statusText = "\uC5F0\uACB0 \uB04A\uAE40";
        this.ui.setInputEnabled(false);
        break;
      case "reconnecting":
        statusText = `\uC7AC\uC5F0\uACB0 \uC911 (${attempt}/${max})`;
        this.ui.setInputEnabled(false);
        break;
      case "banned":
        statusText = "\uC811\uC18D \uCC28\uB2E8\uB428";
        this.ui.setInputEnabled(false);
        break;
      case "error":
        statusText = "\uC624\uB958 \uBC1C\uC0DD";
        this.ui.setInputEnabled(false);
        break;
    }
    this.ui.updateConnectionStatus(status, statusText);
  }
  async handleSubmit(e) {
    e.preventDefault();
    const message = this.ui.getInputValue();
    const trimmedMessage = message.trim();
    const hasFile = this.fileUpload.hasFile();
    if (!trimmedMessage && !hasFile) return;
    if (trimmedMessage === "/summary") {
      this.ui.clearInput();
      await this.requestSummary("default");
      return;
    }
    if (trimmedMessage === "/topic") {
      this.ui.clearInput();
      await this.requestSummary("topic");
      return;
    }
    if (trimmedMessage === "/mood") {
      this.ui.clearInput();
      await this.requestSummary("mood");
      return;
    }
    if (trimmedMessage === "/conflict") {
      this.ui.clearInput();
      await this.requestSummary("conflict");
      return;
    }
    if (trimmedMessage.startsWith("/")) {
      this.ui.clearInput();
      return;
    }
    const now = Date.now();
    if (now - this.lastMessageTime < this.messageRateLimit) {
      this.ui.displayError("\uBA54\uC2DC\uC9C0\uB97C \uB108\uBB34 \uBE60\uB974\uAC8C \uC804\uC1A1\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.");
      return;
    }
    if (message.length > SECURITY.MAX_MESSAGE_LENGTH) {
      this.ui.displayError(`\uBA54\uC2DC\uC9C0\uB294 \uCD5C\uB300 ${SECURITY.MAX_MESSAGE_LENGTH}\uC790\uAE4C\uC9C0 \uAC00\uB2A5\uD569\uB2C8\uB2E4.`);
      return;
    }
    const messageData = {
      type: "message",
      // Preserve newlines; sanitization happens server-side and at render time
      content: message || "",
      sessionId: this.sessionManager.getSessionId(),
      nickname: this.sessionManager.getNickname(),
      timestamp: now
    };
    const replyingTo = this.ui.getReplyingTo();
    if (replyingTo) {
      if (replyingTo.isSecret) {
        try {
          const deadDropResult = await this.deadDrop.store(trimmedMessage || "[\uD30C\uC77C]");
          messageData.replyTo = {
            messageId: replyingTo.messageId,
            content: replyingTo.content,
            isOwnMessage: replyingTo.isOwnMessage,
            isSecret: true,
            secretId: deadDropResult.id,
            targetSessionId: replyingTo.targetSessionId
            // 답장 받는 사람의 sessionId
          };
          messageData.content = `[\uBE44\uBC00 \uBA54\uC2DC\uC9C0]`;
        } catch (error) {
          console.error("Dead Drop store error:", error);
          this.ui.displayError("\uBE44\uBC00 \uBA54\uC2DC\uC9C0 \uC800\uC7A5 \uC2E4\uD328: " + error.message);
          sendErrorReport(error.message || "DeadDrop store error", "ChatClient.sendMessage - deadDrop.store failed");
          return;
        }
      } else {
        messageData.replyTo = {
          messageId: replyingTo.messageId,
          content: replyingTo.content,
          isOwnMessage: replyingTo.isOwnMessage
        };
      }
    }
    if (hasFile) {
      try {
        const filesData = await this.fileUpload.uploadFiles();
        if (filesData.length === 1) {
          messageData.file = {
            url: filesData[0].url,
            filename: filesData[0].filename,
            filesize: filesData[0].filesize,
            filetype: filesData[0].filetype
          };
        } else if (filesData.length > 1) {
          messageData.files = filesData.map((f) => ({
            url: f.url,
            filename: f.filename,
            filesize: f.filesize,
            filetype: f.filetype
          }));
        }
        this.fileUpload.clearFiles();
      } catch (error) {
        console.error("File upload failed:", error);
        this.ui.displayError("\uD30C\uC77C \uC5C5\uB85C\uB4DC \uC2E4\uD328: " + error.message);
        sendErrorReport(error.message || "File upload failed", "ChatClient.sendMessage - file upload failed");
        return;
      }
    }
    try {
      this.wsManager.send(messageData);
      if (trimmedMessage && !trimmedMessage.startsWith("/")) {
        this._messageHistory.push(trimmedMessage);
        this._historyIndex = this._messageHistory.length;
      }
      if (!this.wsManager.isConnected()) {
        sendErrorReport("Message send attempted while WebSocket not connected", "ChatClient.sendMessage - ws not connected");
        this.ui.displayError("\uBA54\uC2DC\uC9C0 \uC804\uC1A1 \uC2E4\uD328: \uC5F0\uACB0\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      }
    } catch (err) {
      console.error("Message send error:", err);
      sendErrorReport(err.message || "Message send error", "ChatClient.sendMessage - exception on send");
      this.ui.displayError("\uBA54\uC2DC\uC9C0 \uC804\uC1A1 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
    this.lastMessageTime = now;
    this.ui.clearInput();
    this.ui.cancelReply();
    this.ui.messageInput.focus();
  }
  // Note: 서명 생성은 서버에서만 수행됨 (보안 강화)
  // 클라이언트는 서명 없이 메시지를 전송하고, 서버가 검증 후 서명을 추가함
  handleInput() {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    if (this._historyIndex < this._messageHistory.length) {
      this._historyIndex = this._messageHistory.length;
      this._historySavedInput = "";
    }
    this.updateCommandPopup();
  }
  handleTyping() {
    if (!this.isTyping && this.ui.getInputLength() > 0) {
      this.isTyping = true;
      this.wsManager.send({
        type: "typing",
        sessionId: this.sessionManager.getSessionId(),
        nickname: this.sessionManager.getNickname(),
        typing: true
      });
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    this.typingTimeout = setTimeout(() => {
      if (this.isTyping) {
        this.isTyping = false;
        this.wsManager.send({
          type: "typing",
          sessionId: this.sessionManager.getSessionId(),
          nickname: this.sessionManager.getNickname(),
          typing: false
        });
      }
    }, UI.TYPING_INACTIVITY_MS);
  }
  async editMessage(messageId, newContent) {
    if (!newContent || newContent.trim().length === 0) {
      this.ui.displayError("\uBA54\uC2DC\uC9C0 \uB0B4\uC6A9\uC774 \uBE44\uC5B4\uC788\uC2B5\uB2C8\uB2E4.");
      return;
    }
    if (newContent.length > SECURITY.MAX_MESSAGE_LENGTH) {
      this.ui.displayError(`\uBA54\uC2DC\uC9C0\uB294 \uCD5C\uB300 ${SECURITY.MAX_MESSAGE_LENGTH}\uC790\uAE4C\uC9C0 \uAC00\uB2A5\uD569\uB2C8\uB2E4.`);
      return;
    }
    const now = Date.now();
    const editData = {
      type: "edit",
      messageId,
      newContent,
      sessionId: this.sessionManager.getSessionId(),
      timestamp: now
    };
    this.wsManager.send(editData);
  }
  async deleteMessage(messageId) {
    const deleteData = {
      type: "delete",
      messageId,
      sessionId: this.sessionManager.getSessionId(),
      timestamp: Date.now()
    };
    this.wsManager.send(deleteData);
  }
  sendReaction(messageId, emoji, hasReacted) {
    this.wsManager.send({
      type: "reaction",
      messageId,
      emoji,
      action: hasReacted ? "remove" : "add",
      sessionId: this.sessionManager.getSessionId(),
      timestamp: Date.now()
    });
  }
  // ========== Channel Management ==========
  async switchChannel(channelId, channelName = "") {
    channelId = String(channelId || "0");
    if (this.currentChannel === channelId) return;
    this.currentChannel = channelId;
    this.currentChannelName = channelName;
    try {
      localStorage.setItem("chatCurrentChannel", channelId);
      if (channelName) {
        localStorage.setItem("chatCurrentChannelName", channelName);
      } else {
        localStorage.removeItem("chatCurrentChannelName");
      }
    } catch (_e) {
    }
    this.ui.updateChannelIndicator(channelId, channelName);
    this.ui.clearAllMessages();
    this.wsManager.channelId = channelId;
    this.wsManager.manualClose = true;
    this.wsManager.disconnect();
    this.wsManager.manualClose = false;
    setTimeout(() => {
      this.wsManager.connect();
    }, 300);
  }
  async createChannel(name) {
    if (this.ui._channelProcessing) return;
    if (!name) {
      this.ui.showCreateChannelError("\uCC44\uB110 \uC774\uB984\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
      return;
    }
    if (name.length > CHANNEL.MAX_NAME_LENGTH) {
      this.ui.showCreateChannelError(`\uCC44\uB110 \uC774\uB984\uC740 \uCD5C\uB300 ${CHANNEL.MAX_NAME_LENGTH}\uC790\uC785\uB2C8\uB2E4.`);
      return;
    }
    this.ui._channelProcessing = true;
    try {
      const resp = await api_client_default.postRaw("/api/channels/create", { name, sessionId: this.sessionManager.getSessionId() });
      const data = await resp.json();
      if (!resp.ok) {
        this.ui.showCreateChannelError(data.error || "\uCC44\uB110 \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
        return;
      }
      this.ui.hideCreateChannelModal();
      await this.switchChannel(data.slug, data.name);
      this.ui.displaySystemMessage(`\uCC44\uB110 "${data.name}"\uC5D0 \uC785\uC7A5\uD588\uC2B5\uB2C8\uB2E4.`);
    } catch (error) {
      console.error("Create channel error:", error);
      this.ui.showCreateChannelError("\uB124\uD2B8\uC6CC\uD06C \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    } finally {
      this.ui._channelProcessing = false;
    }
  }
  async joinChannel(raw) {
    if (this.ui._channelProcessing) return;
    const trimmed = String(raw || "").trim();
    if (!trimmed) {
      this.ui.showJoinChannelError("\uCC44\uB110 \uC774\uB984\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
      return;
    }
    this.ui._channelProcessing = true;
    try {
      const resp = await api_client_default.postRaw("/api/channels/join", { name: trimmed });
      const data = await resp.json();
      if (!resp.ok) {
        this.ui.showJoinChannelError(data.error || "\uCC44\uB110\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        return;
      }
      this.ui.hideJoinChannelModal();
      await this.switchChannel(data.slug, data.name);
      this.ui.displaySystemMessage(`\uCC44\uB110 "${data.name}"\uC5D0 \uC785\uC7A5\uD588\uC2B5\uB2C8\uB2E4.`);
    } catch (error) {
      console.error("Join channel error:", error);
      this.ui.showJoinChannelError("\uB124\uD2B8\uC6CC\uD06C \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    } finally {
      this.ui._channelProcessing = false;
    }
  }
  scrollToMessage(messageId) {
    const messageEl = this.ui.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
      messageEl.scrollIntoView({ behavior: "smooth", block: "center" });
      messageEl.classList.add("ring-2", "ring-blue-500");
      setTimeout(() => {
        messageEl.classList.remove("ring-2", "ring-blue-500");
      }, 2e3);
    }
  }
  async revealSecretMessage(secretId, container) {
    const btn = container.querySelector(".reveal-secret-btn");
    const contentDiv = container.querySelector(".secret-message-content");
    if (!btn || !contentDiv) return;
    btn.disabled = true;
    btn.textContent = "\uC77D\uB294 \uC911...";
    try {
      const result = await this.deadDrop.read(secretId);
      btn.remove();
      contentDiv.classList.remove("hidden");
      contentDiv.innerHTML = `
                <div class="text-green-400 text-xs mb-2">\u2713 \uBE44\uBC00 \uBA54\uC2DC\uC9C0\uAC00 \uACF5\uAC1C\uB418\uC5C8\uC2B5\uB2C8\uB2E4 (\uC774 \uBA54\uC2DC\uC9C0\uB294 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4)</div>
                <div class="text-gray-100">${escapeHtml(result.message)}</div>
            `;
    } catch (error) {
      console.error("Failed to reveal secret:", error);
      btn.textContent = "\uC77D\uAE30 \uC2E4\uD328";
      btn.classList.add("bg-red-600", "hover:bg-red-500");
      btn.classList.remove("bg-purple-600", "hover:bg-purple-500");
      contentDiv.classList.remove("hidden");
      contentDiv.innerHTML = `
                <div class="text-red-400 text-sm">
                    \u274C ${error.message}
                </div>
            `;
    }
  }
  async requestSummary(mode = "default") {
    this.ui.clearInput();
    const loadingMsg = this.ui.displaySystemMessage("AI\uAC00 \uB300\uD654 \uC694\uC57D\uC744 \uC0DD\uC131 \uC911\uC785\uB2C8\uB2E4...");
    try {
      const res = await api_client_default.postRaw("/api/summary", { mode });
      loadingMsg.remove();
      if (res.status !== 204 && !res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 503) {
          this.ui.displayError("AI \uBAA8\uB378\uC774 \uD63C\uC7A1\uD569\uB2C8\uB2E4. 1~2\uBD84 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.");
        } else {
          this.ui.displayError(data.error || "\uC694\uC57D \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
        }
      }
    } catch (_err) {
      loadingMsg.remove();
      this.ui.displayError("\uC694\uC57D \uC694\uCCAD \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  }
  initializeCommandPopup() {
    const input = this.ui.messageInput;
    if (!input) return;
    input.addEventListener("keydown", (e) => {
      if (this.isCommandPopupOpen()) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          this.selectCommandPopup(this._cmdSelected + 1);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          this.selectCommandPopup(this._cmdSelected - 1);
        }
        if (e.key === "Enter") {
          e.preventDefault();
          this.applyCommandPopup();
        }
        if (e.key === "Tab") {
          e.preventDefault();
          this.applyCommandPopup();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          this.hideCommandPopup();
        }
        return;
      }
      if (e.key === "ArrowUp" && this._messageHistory.length > 0) {
        e.preventDefault();
        if (this._historyIndex === this._messageHistory.length) {
          this._historySavedInput = this.ui.getInputValue();
        }
        if (this._historyIndex > 0) {
          this._historyIndex--;
          this.ui.messageInput.value = this._messageHistory[this._historyIndex];
          this.ui.messageInput.focus();
        }
      }
      if (e.key === "ArrowDown" && this._historyIndex < this._messageHistory.length) {
        e.preventDefault();
        if (this._historyIndex < this._messageHistory.length - 1) {
          this._historyIndex++;
          this.ui.messageInput.value = this._messageHistory[this._historyIndex];
        } else {
          this._historyIndex = this._messageHistory.length;
          this.ui.messageInput.value = this._historySavedInput;
        }
        this.ui.messageInput.focus();
      }
    });
    const popup = document.getElementById("command-popup");
    if (popup) {
      popup.addEventListener("click", (e) => {
        const item = e.target.closest(".cmd-item");
        if (item) {
          this.ui.clearInput();
          this.ui.messageInput.value = item.dataset.cmd;
          this.ui.messageInput.focus();
          this.hideCommandPopup();
        }
      });
    }
  }
  updateCommandPopup() {
    const popup = document.getElementById("command-popup");
    if (!popup) return;
    const value = this.ui.getInputValue();
    if (!value.startsWith("/") || value.includes(" ")) {
      popup.classList.add("hidden");
      this._cmdSelected = -1;
      return;
    }
    const filter = value.toLowerCase();
    const items = popup.querySelectorAll(".cmd-item");
    let visible = 0;
    this._cmdSelected = -1;
    items.forEach((item, _i) => {
      item.classList.remove("selected");
      const cmd = item.dataset.cmd.toLowerCase();
      if (cmd.startsWith(filter)) {
        item.classList.remove("hidden");
        visible++;
      } else {
        item.classList.add("hidden");
      }
    });
    if (visible > 0) {
      popup.classList.remove("hidden");
    } else {
      popup.classList.add("hidden");
    }
  }
  selectCommandPopup(index) {
    const popup = document.getElementById("command-popup");
    if (!popup || popup.classList.contains("hidden")) return;
    const items = popup.querySelectorAll(".cmd-item:not(.hidden)");
    if (items.length === 0) return;
    items.forEach((item) => item.classList.remove("selected"));
    if (index < 0) {
      this._cmdSelected = -1;
      return;
    }
    if (index >= items.length) index = 0;
    if (index < 0) index = items.length - 1;
    items[index].classList.add("selected");
    items[index].scrollIntoView({ block: "nearest" });
    this._cmdSelected = index;
  }
  applyCommandPopup() {
    const popup = document.getElementById("command-popup");
    if (!popup || popup.classList.contains("hidden")) return;
    const items = popup.querySelectorAll(".cmd-item:not(.hidden)");
    const idx = this._cmdSelected >= 0 ? this._cmdSelected : 0;
    if (idx < items.length) {
      const cmd = items[idx].dataset.cmd;
      this.ui.clearInput();
      this.ui.messageInput.value = cmd;
      this.ui.messageInput.focus();
    }
    popup.classList.add("hidden");
    this._cmdSelected = -1;
  }
  hideCommandPopup() {
    const popup = document.getElementById("command-popup");
    if (popup) popup.classList.add("hidden");
    this._cmdSelected = -1;
  }
  isCommandPopupOpen() {
    const popup = document.getElementById("command-popup");
    return popup && !popup.classList.contains("hidden");
  }
};
document.addEventListener("DOMContentLoaded", async () => {
  let config = {};
  try {
    config = await api_client_default.get("/api/config");
  } catch (_e) {
  }
  if (!config.turnstileSiteKey) {
    console.error("Failed to load configuration");
    return;
  }
  const emergency = await api_client_default.get("/api/emergency-announcement").catch(() => ({ isEmergency: false }));
  if (emergency.isEmergency) {
    const seenTs = localStorage.getItem("chatEmergencySeenTs");
    if (String(emergency.timestamp) !== seenTs) {
      localStorage.setItem("chatEmergencySeenTs", String(emergency.timestamp));
      localStorage.setItem("chatEmergencyRedirectTime", String(Date.now()));
      location.href = "/announcements.html?from=emergency";
      return;
    }
    localStorage.removeItem("chatEmergencyRedirectTime");
  } else {
    localStorage.removeItem("chatEmergencySeenTs");
    localStorage.removeItem("chatEmergencyRedirectTime");
  }
  window.chatClient = new ChatClient(config);
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (window.chatClient) {
      window.chatClient.clearUnreadTitle();
      if (window.chatClient.wsManager) {
        window.chatClient.wsManager.checkConnection();
      }
    }
  }
});
window.addEventListener("online", () => {
  if (window.chatClient && window.chatClient.wsManager) {
    window.chatClient.wsManager.checkConnection();
  }
});
window.addEventListener("beforeunload", () => {
  if (window.chatClient && window.chatClient.wsManager) {
    window.chatClient.wsManager.disconnect();
  }
});
/*! Bundled license information:

prismjs/prism.js:
  (**
   * Prism: Lightweight, robust, elegant syntax highlighting
   *
   * @license MIT <https://opensource.org/licenses/MIT>
   * @author Lea Verou <https://lea.verou.me>
   * @namespace
   * @public
   *)
*/
