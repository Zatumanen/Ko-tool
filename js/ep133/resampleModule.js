const createResampleModule = (() => {
    var _scriptDir = import.meta.url;
    return function (moduleArg = {}) {
      var Module = moduleArg,
        readyPromiseResolve,
        readyPromiseReject;
      (Module.ready = new Promise((a, s) => {
        (readyPromiseResolve = a), (readyPromiseReject = s);
      })),
        (Module.noExitRuntime = !1),
        (Module.noInitialRun = !0);
      var moduleOverrides = Object.assign({}, Module),
        arguments_ = [],
        thisProgram = "./this.program",
        quit_ = (a, s) => {
          throw s;
        },
        ENVIRONMENT_IS_WEB = !0,
        scriptDirectory = "";
      function locateFile(a) {
        return Module.locateFile
          ? Module.locateFile(a, scriptDirectory)
          : scriptDirectory + a;
      }
      var read_, readAsync;
      typeof document < "u" &&
        document.currentScript &&
        (scriptDirectory = document.currentScript.src),
        _scriptDir && (scriptDirectory = _scriptDir),
        scriptDirectory.indexOf("blob:") !== 0
          ? (scriptDirectory = scriptDirectory.substr(
              0,
              scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1
            ))
          : (scriptDirectory = ""),
        (read_ = (a) => {
          var s = new XMLHttpRequest();
          return s.open("GET", a, !1), s.send(null), s.responseText;
        }),
        (readAsync = (a, s, o) => {
          var _ = new XMLHttpRequest();
          _.open("GET", a, !0),
            (_.responseType = "arraybuffer"),
            (_.onload = () => {
              if (_.status == 200 || (_.status == 0 && _.response)) {
                s(_.response);
                return;
              }
              o();
            }),
            (_.onerror = o),
            _.send(null);
        });
      var out = Module.print || console.log.bind(console),
        err = Module.printErr || console.error.bind(console);
      Object.assign(Module, moduleOverrides),
        (moduleOverrides = null),
        Module.arguments && (arguments_ = Module.arguments),
        Module.thisProgram && (thisProgram = Module.thisProgram),
        Module.quit && (quit_ = Module.quit);
      var dynamicLibraries = Module.dynamicLibraries || [],
        wasmBinary;
      Module.wasmBinary && (wasmBinary = Module.wasmBinary),
        typeof WebAssembly != "object" &&
          abort("no native wasm support detected");
      var wasmMemory,
        ABORT = !1,
        EXITSTATUS;
      function assert(a, s) {
        a || abort(s);
      }
      var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
      function updateMemoryViews() {
        var a = wasmMemory.buffer;
        (Module.HEAP8 = HEAP8 = new Int8Array(a)),
          (Module.HEAP16 = HEAP16 = new Int16Array(a)),
          (Module.HEAPU8 = HEAPU8 = new Uint8Array(a)),
          (Module.HEAPU16 = HEAPU16 = new Uint16Array(a)),
          (Module.HEAP32 = HEAP32 = new Int32Array(a)),
          (Module.HEAPU32 = HEAPU32 = new Uint32Array(a)),
          (Module.HEAPF32 = HEAPF32 = new Float32Array(a)),
          (Module.HEAPF64 = HEAPF64 = new Float64Array(a));
      }
      var INITIAL_MEMORY = Module.INITIAL_MEMORY || 16777216;
      Module.wasmMemory
        ? (wasmMemory = Module.wasmMemory)
        : (wasmMemory = new WebAssembly.Memory({
            initial: INITIAL_MEMORY / 65536,
            maximum: 2147483648 / 65536,
          })),
        updateMemoryViews(),
        (INITIAL_MEMORY = wasmMemory.buffer.byteLength);
      var __ATPRERUN__ = [],
        __ATINIT__ = [],
        __ATMAIN__ = [],
        __ATEXIT__ = [],
        __ATPOSTRUN__ = [],
        __RELOC_FUNCS__ = [],
        runtimeInitialized = !1;
      function preRun() {
        if (Module.preRun)
          for (
            typeof Module.preRun == "function" &&
            (Module.preRun = [Module.preRun]);
            Module.preRun.length;

          )
            addOnPreRun(Module.preRun.shift());
        callRuntimeCallbacks(__ATPRERUN__);
      }
      function initRuntime() {
        (runtimeInitialized = !0),
          callRuntimeCallbacks(__RELOC_FUNCS__),
          !Module.noFSInit && !FS.init.initialized && FS.init(),
          (FS.ignorePermissions = !1),
          callRuntimeCallbacks(__ATINIT__);
      }
      function preMain() {
        callRuntimeCallbacks(__ATMAIN__);
      }
      function exitRuntime() {
        ___funcs_on_exit(), callRuntimeCallbacks(__ATEXIT__), FS.quit();
      }
      function postRun() {
        if (Module.postRun)
          for (
            typeof Module.postRun == "function" &&
            (Module.postRun = [Module.postRun]);
            Module.postRun.length;

          )
            addOnPostRun(Module.postRun.shift());
        callRuntimeCallbacks(__ATPOSTRUN__);
      }
      function addOnPreRun(a) {
        __ATPRERUN__.unshift(a);
      }
      function addOnInit(a) {
        __ATINIT__.unshift(a);
      }
      function addOnPostRun(a) {
        __ATPOSTRUN__.unshift(a);
      }
      var runDependencies = 0,
        dependenciesFulfilled = null;
      function getUniqueRunDependency(a) {
        return a;
      }
      function addRunDependency(a) {
        runDependencies++,
          Module.monitorRunDependencies &&
            Module.monitorRunDependencies(runDependencies);
      }
      function removeRunDependency(a) {
        if (
          (runDependencies--,
          Module.monitorRunDependencies &&
            Module.monitorRunDependencies(runDependencies),
          runDependencies == 0 && dependenciesFulfilled)
        ) {
          var s = dependenciesFulfilled;
          (dependenciesFulfilled = null), s();
        }
      }
      function abort(a) {
        Module.onAbort && Module.onAbort(a),
          (a = "Aborted(" + a + ")"),
          err(a),
          (ABORT = !0),
          (EXITSTATUS = 1),
          (a += ". Build with -sASSERTIONS for more info.");
        var s = new WebAssembly.RuntimeError(a);
        throw (readyPromiseReject(s), s);
      }
      var dataURIPrefix = "data:application/octet-stream;base64,",
        isDataURI = (a) => a.startsWith(dataURIPrefix),
        wasmBinaryFile;
      Module.locateFile
        ? ((wasmBinaryFile = "resample.wasm"),
          isDataURI(wasmBinaryFile) ||
            (wasmBinaryFile = locateFile(wasmBinaryFile)))
        : (wasmBinaryFile = new URL("resample.wasm", import.meta.url).href);
      function getBinarySync(a) {
        if (a == wasmBinaryFile && wasmBinary)
          return new Uint8Array(wasmBinary);
        throw "both async and sync fetching of the wasm failed";
      }
      function getBinaryPromise(a) {
        return !wasmBinary && ENVIRONMENT_IS_WEB && typeof fetch == "function"
          ? fetch(a, {
              credentials: "same-origin",
            })
              .then((s) => {
                if (!s.ok)
                  throw "failed to load wasm binary file at '" + a + "'";
                return s.arrayBuffer();
              })
              .catch(() => getBinarySync(a))
          : Promise.resolve().then(() => getBinarySync(a));
      }
      function instantiateArrayBuffer(a, s, o) {
        return getBinaryPromise(a)
          .then((_) => WebAssembly.instantiate(_, s))
          .then((_) => _)
          .then(o, (_) => {
            err(`failed to asynchronously prepare wasm: ${_}`), abort(_);
          });
      }
      function instantiateAsync(a, s, o, _) {
        return !a &&
          typeof WebAssembly.instantiateStreaming == "function" &&
          !isDataURI(s) &&
          typeof fetch == "function"
          ? fetch(s, {
              credentials: "same-origin",
            }).then((c) => {
              var d = WebAssembly.instantiateStreaming(c, o);
              return d.then(_, function (g) {
                return (
                  err(`wasm streaming compile failed: ${g}`),
                  err("falling back to ArrayBuffer instantiation"),
                  instantiateArrayBuffer(s, o, _)
                );
              });
            })
          : instantiateArrayBuffer(s, o, _);
      }
      function createWasm() {
        var a = {
          env: wasmImports,
          wasi_snapshot_preview1: wasmImports,
          "GOT.mem": new Proxy(wasmImports, GOTHandler),
          "GOT.func": new Proxy(wasmImports, GOTHandler),
        };
        function s(_, c) {
          return (
            (wasmExports = _.exports),
            (wasmExports = relocateExports(wasmExports, 1024)),
            getDylinkMetadata(c),
            mergeLibSymbols(wasmExports),
            LDSO.init(),
            loadDylibs(),
            addOnInit(wasmExports.__wasm_call_ctors),
            __RELOC_FUNCS__.push(wasmExports.__wasm_apply_data_relocs),
            removeRunDependency(),
            wasmExports
          );
        }
        addRunDependency();
        function o(_) {
          s(_.instance, _.module);
        }
        if (Module.instantiateWasm)
          try {
            return Module.instantiateWasm(a, s);
          } catch (_) {
            err(`Module.instantiateWasm callback failed with error: ${_}`),
              readyPromiseReject(_);
          }
        return (
          instantiateAsync(wasmBinary, wasmBinaryFile, a, o).catch(
            readyPromiseReject
          ),
          {}
        );
      }
      var tempDouble, tempI64;
      function ExitStatus(a) {
        (this.name = "ExitStatus"),
          (this.message = `Program terminated with exit(${a})`),
          (this.status = a);
      }
      var GOT = {},
        currentModuleWeakSymbols = new Set([]),
        GOTHandler = {
          get(a, s) {
            var o = GOT[s];
            return (
              o ||
                (o = GOT[s] =
                  new WebAssembly.Global({
                    value: "i32",
                    mutable: !0,
                  })),
              currentModuleWeakSymbols.has(s) || (o.required = !0),
              o
            );
          },
        },
        callRuntimeCallbacks = (a) => {
          for (; a.length > 0; ) a.shift()(Module);
        },
        UTF8Decoder =
          typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0,
        UTF8ArrayToString = (a, s, o) => {
          for (var _ = s + o, c = s; a[c] && !(c >= _); ) ++c;
          if (c - s > 16 && a.buffer && UTF8Decoder)
            return UTF8Decoder.decode(a.subarray(s, c));
          for (var d = ""; s < c; ) {
            var g = a[s++];
            if (!(g & 128)) {
              d += String.fromCharCode(g);
              continue;
            }
            var b = a[s++] & 63;
            if ((g & 224) == 192) {
              d += String.fromCharCode(((g & 31) << 6) | b);
              continue;
            }
            var h = a[s++] & 63;
            if (
              ((g & 240) == 224
                ? (g = ((g & 15) << 12) | (b << 6) | h)
                : (g = ((g & 7) << 18) | (b << 12) | (h << 6) | (a[s++] & 63)),
              g < 65536)
            )
              d += String.fromCharCode(g);
            else {
              var j = g - 65536;
              d += String.fromCharCode(55296 | (j >> 10), 56320 | (j & 1023));
            }
          }
          return d;
        },
        getDylinkMetadata = (a) => {
          var s = 0,
            o = 0;
          function _() {
            return a[s++];
          }
          function c() {
            for (var Nt = 0, St = 1; ; ) {
              var Lt = a[s++];
              if (((Nt += (Lt & 127) * St), (St *= 128), !(Lt & 128))) break;
            }
            return Nt;
          }
          function d() {
            var Nt = c();
            return (s += Nt), UTF8ArrayToString(a, s - Nt, Nt);
          }
          function g(Nt, St) {
            if (Nt) throw new Error(St);
          }
          var b = "dylink.0";
          if (a instanceof WebAssembly.Module) {
            var h = WebAssembly.Module.customSections(a, b);
            h.length === 0 &&
              ((b = "dylink"), (h = WebAssembly.Module.customSections(a, b))),
              g(h.length === 0, "need dylink section"),
              (a = new Uint8Array(h[0])),
              (o = a.length);
          } else {
            var j = new Uint32Array(new Uint8Array(a.subarray(0, 24)).buffer),
              $ = j[0] == 1836278016;
            g(!$, "need to see wasm magic number"),
              g(a[8] !== 0, "need the dylink section to be first"),
              (s = 9);
            var et = c();
            (o = s + et), (b = d());
          }
          var _e = {
            neededDynlibs: [],
            tlsExports: new Set(),
            weakImports: new Set(),
          };
          if (b == "dylink") {
            (_e.memorySize = c()),
              (_e.memoryAlign = c()),
              (_e.tableSize = c()),
              (_e.tableAlign = c());
            for (var it = c(), ot = 0; ot < it; ++ot) {
              var st = d();
              _e.neededDynlibs.push(st);
            }
          } else {
            g(b !== "dylink.0");
            for (
              var nt = 1, rt = 2, tt = 3, at = 4, Et = 256, lt = 3, _t = 1;
              s < o;

            ) {
              var ut = _(),
                ct = c();
              if (ut === nt)
                (_e.memorySize = c()),
                  (_e.memoryAlign = c()),
                  (_e.tableSize = c()),
                  (_e.tableAlign = c());
              else if (ut === rt)
                for (var it = c(), ot = 0; ot < it; ++ot)
                  (st = d()), _e.neededDynlibs.push(st);
              else if (ut === tt)
                for (var dt = c(); dt--; ) {
                  var pt = d(),
                    gt = c();
                  gt & Et && _e.tlsExports.add(pt);
                }
              else if (ut === at)
                for (var dt = c(); dt--; ) {
                  d();
                  var pt = d(),
                    gt = c();
                  (gt & lt) == _t && _e.weakImports.add(pt);
                }
              else s += ct;
            }
          }
          return _e;
        },
        newDSO = (a, s, o) => {
          var _ = {
            refcount: 1 / 0,
            name: a,
            exports: o,
            global: !0,
          };
          return (
            (LDSO.loadedLibsByName[a] = _),
            s != null && (LDSO.loadedLibsByHandle[s] = _),
            _
          );
        },
        LDSO = {
          loadedLibsByName: {},
          loadedLibsByHandle: {},
          init() {
            newDSO("__main__", 0, wasmImports);
          },
        },
        ___heap_base = 126352,
        zeroMemory = (a, s) => (HEAPU8.fill(0, a, a + s), a),
        alignMemory = (a, s) => Math.ceil(a / s) * s,
        getMemory = (a) => {
          if (runtimeInitialized) return zeroMemory(_malloc(a), a);
          var s = ___heap_base,
            o = s + alignMemory(a, 16);
          return (___heap_base = o), (GOT.__heap_base.value = o), s;
        },
        isInternalSym = (a) =>
          [
            "__cpp_exception",
            "__c_longjmp",
            "__wasm_apply_data_relocs",
            "__dso_handle",
            "__tls_size",
            "__tls_align",
            "__set_stack_limits",
            "_emscripten_tls_init",
            "__wasm_init_tls",
            "__wasm_call_ctors",
            "__start_em_asm",
            "__stop_em_asm",
            "__start_em_js",
            "__stop_em_js",
          ].includes(a) || a.startsWith("__em_js__"),
        uleb128Encode = (a, s) => {
          a < 128 ? s.push(a) : s.push(a % 128 | 128, a >> 7);
        },
        sigToWasmTypes = (a) => {
          for (
            var s = {
                i: "i32",
                j: "i64",
                f: "f32",
                d: "f64",
                e: "externref",
                p: "i32",
              },
              o = {
                parameters: [],
                results: a[0] == "v" ? [] : [s[a[0]]],
              },
              _ = 1;
            _ < a.length;
            ++_
          )
            o.parameters.push(s[a[_]]);
          return o;
        },
        generateFuncType = (a, s) => {
          var o = a.slice(0, 1),
            _ = a.slice(1),
            c = {
              i: 127,
              p: 127,
              j: 126,
              f: 125,
              d: 124,
              e: 111,
            };
          s.push(96), uleb128Encode(_.length, s);
          for (var d = 0; d < _.length; ++d) s.push(c[_[d]]);
          o == "v" ? s.push(0) : s.push(1, c[o]);
        },
        convertJsFunctionToWasm = (a, s) => {
          if (typeof WebAssembly.Function == "function")
            return new WebAssembly.Function(sigToWasmTypes(s), a);
          var o = [1];
          generateFuncType(s, o);
          var _ = [0, 97, 115, 109, 1, 0, 0, 0, 1];
          uleb128Encode(o.length, _),
            _.push.apply(_, o),
            _.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
          var c = new WebAssembly.Module(new Uint8Array(_)),
            d = new WebAssembly.Instance(c, {
              e: {
                f: a,
              },
            }),
            g = d.exports.f;
          return g;
        },
        wasmTable = new WebAssembly.Table({
          initial: 422,
          element: "anyfunc",
        }),
        getWasmTableEntry = (a) => wasmTable.get(a),
        updateTableMap = (a, s) => {
          if (functionsInTableMap)
            for (var o = a; o < a + s; o++) {
              var _ = getWasmTableEntry(o);
              _ && functionsInTableMap.set(_, o);
            }
        },
        functionsInTableMap,
        getFunctionAddress = (a) => (
          functionsInTableMap ||
            ((functionsInTableMap = new WeakMap()),
            updateTableMap(0, wasmTable.length)),
          functionsInTableMap.get(a) || 0
        ),
        freeTableIndexes = [],
        getEmptyTableSlot = () => {
          if (freeTableIndexes.length) return freeTableIndexes.pop();
          try {
            wasmTable.grow(1);
          } catch (a) {
            throw a instanceof RangeError
              ? "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH."
              : a;
          }
          return wasmTable.length - 1;
        },
        setWasmTableEntry = (a, s) => wasmTable.set(a, s),
        addFunction = (a, s) => {
          var o = getFunctionAddress(a);
          if (o) return o;
          var _ = getEmptyTableSlot();
          try {
            setWasmTableEntry(_, a);
          } catch (d) {
            if (!(d instanceof TypeError)) throw d;
            var c = convertJsFunctionToWasm(a, s);
            setWasmTableEntry(_, c);
          }
          return functionsInTableMap.set(a, _), _;
        },
        updateGOT = (a, s) => {
          for (var o in a)
            if (!isInternalSym(o)) {
              var _ = a[o];
              o.startsWith("orig$") && ((o = o.split("$")[1]), (s = !0)),
                GOT[o] ||
                  (GOT[o] = new WebAssembly.Global({
                    value: "i32",
                    mutable: !0,
                  })),
                (s || GOT[o].value == 0) &&
                  (typeof _ == "function"
                    ? (GOT[o].value = addFunction(_))
                    : typeof _ == "number"
                    ? (GOT[o].value = _)
                    : err(`unhandled export type for '${o}': ${typeof _}`));
            }
        },
        relocateExports = (a, s, o) => {
          var _ = {};
          for (var c in a) {
            var d = a[c];
            typeof d == "object" && (d = d.value),
              typeof d == "number" && (d += s),
              (_[c] = d);
          }
          return updateGOT(_, o), _;
        },
        isSymbolDefined = (a) => {
          var s = wasmImports[a];
          return !(!s || s.stub);
        },
        dynCallLegacy = (a, s, o) => {
          var _ = Module["dynCall_" + a];
          return o && o.length ? _.apply(null, [s].concat(o)) : _.call(null, s);
        },
        dynCall = (a, s, o) => {
          if (a.includes("j")) return dynCallLegacy(a, s, o);
          var _ = getWasmTableEntry(s).apply(null, o);
          return _;
        },
        createInvokeFunction = (a) =>
          function () {
            var s = stackSave();
            try {
              return dynCall(
                a,
                arguments[0],
                Array.prototype.slice.call(arguments, 1)
              );
            } catch (o) {
              if ((stackRestore(s), o !== o + 0)) throw o;
              _setThrew(1, 0);
            }
          },
        resolveGlobalSymbol = (a, s = !1) => {
          var o;
          return (
            s && "orig$" + a in wasmImports && (a = "orig$" + a),
            isSymbolDefined(a)
              ? (o = wasmImports[a])
              : a.startsWith("invoke_") &&
                (o = wasmImports[a] = createInvokeFunction(a.split("_")[1])),
            {
              sym: o,
              name: a,
            }
          );
        },
        UTF8ToString = (a, s) => (a ? UTF8ArrayToString(HEAPU8, a, s) : ""),
        loadWebAssemblyModule = (
          binary,
          flags,
          libName,
          localScope,
          handle
        ) => {
          var metadata = getDylinkMetadata(binary);
          currentModuleWeakSymbols = metadata.weakImports;
          function loadModule() {
            var memAlign = Math.pow(2, metadata.memoryAlign),
              memoryBase = metadata.memorySize
                ? alignMemory(
                    getMemory(metadata.memorySize + memAlign),
                    memAlign
                  )
                : 0,
              tableBase = metadata.tableSize ? wasmTable.length : 0,
              tableGrowthNeeded =
                tableBase + metadata.tableSize - wasmTable.length;
            tableGrowthNeeded > 0 && wasmTable.grow(tableGrowthNeeded);
            var moduleExports;
            function resolveSymbol(a) {
              var s = resolveGlobalSymbol(a).sym;
              return (
                !s && localScope && (s = localScope[a]),
                s || (s = moduleExports[a]),
                s
              );
            }
            var proxyHandler = {
                get(a, s) {
                  switch (s) {
                    case "__memory_base":
                      return memoryBase;
                    case "__table_base":
                      return tableBase;
                  }
                  if (s in wasmImports && !wasmImports[s].stub)
                    return wasmImports[s];
                  if (!(s in a)) {
                    var o;
                    a[s] = function () {
                      return (
                        o || (o = resolveSymbol(s)), o.apply(null, arguments)
                      );
                    };
                  }
                  return a[s];
                },
              },
              proxy = new Proxy({}, proxyHandler),
              info = {
                "GOT.mem": new Proxy({}, GOTHandler),
                "GOT.func": new Proxy({}, GOTHandler),
                env: proxy,
                wasi_snapshot_preview1: proxy,
              };
            function postInstantiation(module, instance) {
              updateTableMap(tableBase, metadata.tableSize),
                (moduleExports = relocateExports(instance.exports, memoryBase)),
                flags.allowUndefined || reportUndefinedSymbols();
              function addEmAsm(addr, body) {
                for (
                  var args = [], arity = 0;
                  arity < 16 && body.indexOf("$" + arity) != -1;
                  arity++
                )
                  args.push("$" + arity);
                args = args.join(",");
                var func = `(${args}) => { ${body} };`;
                eval(func);
              }
              if ("__start_em_asm" in moduleExports)
                for (
                  var start = moduleExports.__start_em_asm,
                    stop = moduleExports.__stop_em_asm;
                  start < stop;

                ) {
                  var jsString = UTF8ToString(start);
                  addEmAsm(start, jsString),
                    (start = HEAPU8.indexOf(0, start) + 1);
                }
              function addEmJs(name, cSig, body) {
                var jsArgs = [];
                if (((cSig = cSig.slice(1, -1)), cSig != "void")) {
                  cSig = cSig.split(",");
                  for (var i in cSig) {
                    var jsArg = cSig[i].split(" ").pop();
                    jsArgs.push(jsArg.replace("*", ""));
                  }
                }
                var func = `(${jsArgs}) => ${body};`;
                moduleExports[name] = eval(func);
              }
              for (var name in moduleExports)
                if (name.startsWith("__em_js__")) {
                  var start = moduleExports[name],
                    jsString = UTF8ToString(start),
                    parts = jsString.split("<::>");
                  addEmJs(name.replace("__em_js__", ""), parts[0], parts[1]),
                    delete moduleExports[name];
                }
              var applyRelocs = moduleExports.__wasm_apply_data_relocs;
              applyRelocs &&
                (runtimeInitialized
                  ? applyRelocs()
                  : __RELOC_FUNCS__.push(applyRelocs));
              var init = moduleExports.__wasm_call_ctors;
              return (
                init && (runtimeInitialized ? init() : __ATINIT__.push(init)),
                moduleExports
              );
            }
            if (flags.loadAsync) {
              if (binary instanceof WebAssembly.Module) {
                var instance = new WebAssembly.Instance(binary, info);
                return Promise.resolve(postInstantiation(binary, instance));
              }
              return WebAssembly.instantiate(binary, info).then((a) =>
                postInstantiation(a.module, a.instance)
              );
            }
            var module =
                binary instanceof WebAssembly.Module
                  ? binary
                  : new WebAssembly.Module(binary),
              instance = new WebAssembly.Instance(module, info);
            return postInstantiation(module, instance);
          }
          return flags.loadAsync
            ? metadata.neededDynlibs
                .reduce(
                  (a, s) => a.then(() => loadDynamicLibrary(s, flags)),
                  Promise.resolve()
                )
                .then(loadModule)
            : (metadata.neededDynlibs.forEach((a) =>
                loadDynamicLibrary(a, flags, localScope)
              ),
              loadModule());
        },
        mergeLibSymbols = (a, s) => {
          for (var o in a) {
            if (!a.hasOwnProperty(o)) continue;
            const _ = (d) => {
              isSymbolDefined(d) || (wasmImports[d] = a[o]);
            };
            _(o);
            const c = "__main_argc_argv";
            o == "main" && _(c),
              o == c && _("main"),
              o.startsWith("dynCall_") &&
                !Module.hasOwnProperty(o) &&
                (Module[o] = a[o]);
          }
        },
        asyncLoad = (a, s, o, _) => {
          var c = `al ${a}`;
          readAsync(
            a,
            (d) => {
              assert(d, `Loading data file "${a}" failed (no arrayBuffer).`),
                s(new Uint8Array(d)),
                c && removeRunDependency();
            },
            (d) => {
              if (o) o();
              else throw `Loading data file "${a}" failed.`;
            }
          ),
            c && addRunDependency();
        },
        preloadPlugins = Module.preloadPlugins || [],
        registerWasmPlugin = () => {
          var a = {
            promiseChainEnd: Promise.resolve(),
            canHandle: (s) => !Module.noWasmDecoding && s.endsWith(".so"),
            handle: (s, o, _, c) => {
              a.promiseChainEnd = a.promiseChainEnd
                .then(() =>
                  loadWebAssemblyModule(s, {
                    loadAsync: !0,
                    nodelete: !0,
                  })
                )
                .then(
                  (d) => {
                    (preloadedWasm[o] = d), _(s);
                  },
                  (d) => {
                    err(`failed to instantiate wasm: ${o}: ${d}`), c();
                  }
                );
            },
          };
          preloadPlugins.push(a);
        },
        preloadedWasm = {};
      function loadDynamicLibrary(
        a,
        s = {
          global: !0,
          nodelete: !0,
        },
        o,
        _
      ) {
        var c = LDSO.loadedLibsByName[a];
        if (c)
          return (
            s.global &&
              (c.global || ((c.global = !0), mergeLibSymbols(c.exports))),
            s.nodelete && c.refcount !== 1 / 0 && (c.refcount = 1 / 0),
            c.refcount++,
            s.loadAsync ? Promise.resolve(!0) : !0
          );
        (c = newDSO(a, _, "loading")),
          (c.refcount = s.nodelete ? 1 / 0 : 1),
          (c.global = s.global);
        function d() {
          var h = locateFile(a);
          if (s.loadAsync)
            return new Promise(function (j, $) {
              asyncLoad(h, (et) => j(et), $);
            });
          throw new Error(
            `${h}: file not found, and synchronous loading of external files is not available`
          );
        }
        function g() {
          var h = preloadedWasm[a];
          return h
            ? s.loadAsync
              ? Promise.resolve(h)
              : h
            : s.loadAsync
            ? d().then((j) => loadWebAssemblyModule(j, s, a, o))
            : loadWebAssemblyModule(d(), s, a, o);
        }
        function b(h) {
          c.global && mergeLibSymbols(h), (c.exports = h);
        }
        return s.loadAsync ? g().then((h) => (b(h), !0)) : (b(g()), !0);
      }
      var reportUndefinedSymbols = () => {
          for (var a in GOT)
            if (GOT[a].value == 0) {
              var s = resolveGlobalSymbol(a, !0).sym;
              if (!s && !GOT[a].required) continue;
              if (typeof s == "function") GOT[a].value = addFunction(s, s.sig);
              else if (typeof s == "number") GOT[a].value = s;
              else throw new Error(`bad export type for '${a}': ${typeof s}`);
            }
        },
        loadDylibs = () => {
          if (!dynamicLibraries.length) {
            reportUndefinedSymbols();
            return;
          }
          addRunDependency(),
            dynamicLibraries
              .reduce(
                (a, s) =>
                  a.then(() =>
                    loadDynamicLibrary(s, {
                      loadAsync: !0,
                      global: !0,
                      nodelete: !0,
                      allowUndefined: !0,
                    })
                  ),
                Promise.resolve()
              )
              .then(() => {
                reportUndefinedSymbols(), removeRunDependency();
              });
        },
        noExitRuntime = Module.noExitRuntime || !1;
      function __ZN4utf812invalid_utf8D0Ev() {
        return wasmImports._ZN4utf812invalid_utf8D0Ev.apply(null, arguments);
      }
      __ZN4utf812invalid_utf8D0Ev.stub = !0;
      function __ZN4utf813invalid_utf16D0Ev() {
        return wasmImports._ZN4utf813invalid_utf16D0Ev.apply(null, arguments);
      }
      __ZN4utf813invalid_utf16D0Ev.stub = !0;
      function __ZN4utf815not_enough_roomD0Ev() {
        return wasmImports._ZN4utf815not_enough_roomD0Ev.apply(null, arguments);
      }
      __ZN4utf815not_enough_roomD0Ev.stub = !0;
      function __ZN4utf818invalid_code_pointD0Ev() {
        return wasmImports._ZN4utf818invalid_code_pointD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN4utf818invalid_code_pointD0Ev.stub = !0;
      function __ZN4utf84nextIPKcEEjRT_S3_() {
        return wasmImports._ZN4utf84nextIPKcEEjRT_S3_.apply(null, arguments);
      }
      __ZN4utf84nextIPKcEEjRT_S3_.stub = !0;
      function __ZN4utf86appendINSt3__211__wrap_iterIPcEEEET_jS5_() {
        return wasmImports._ZN4utf86appendINSt3__211__wrap_iterIPcEEEET_jS5_.apply(
          null,
          arguments
        );
      }
      __ZN4utf86appendINSt3__211__wrap_iterIPcEEEET_jS5_.stub = !0;
      function __ZN4utf88internal13validate_nextIPKcEENS0_9utf_errorERT_S5_Rj() {
        return wasmImports._ZN4utf88internal13validate_nextIPKcEENS0_9utf_errorERT_S5_Rj.apply(
          null,
          arguments
        );
      }
      __ZN4utf88internal13validate_nextIPKcEENS0_9utf_errorERT_S5_Rj.stub = !0;
      function __ZN4utf88utf16to8INSt3__211__wrap_iterIPKwEENS2_IPcEEEET0_T_S9_S8_() {
        return wasmImports._ZN4utf88utf16to8INSt3__211__wrap_iterIPKwEENS2_IPcEEEET0_T_S9_S8_.apply(
          null,
          arguments
        );
      }
      __ZN4utf88utf16to8INSt3__211__wrap_iterIPKwEENS2_IPcEEEET0_T_S9_S8_.stub =
        !0;
      function __ZN6TagLib10ByteVectorC1EPKcj() {
        return wasmImports._ZN6TagLib10ByteVectorC1EPKcj.apply(null, arguments);
      }
      __ZN6TagLib10ByteVectorC1EPKcj.stub = !0;
      function __ZN6TagLib10ByteVectorD1Ev() {
        return wasmImports._ZN6TagLib10ByteVectorD1Ev.apply(null, arguments);
      }
      __ZN6TagLib10ByteVectorD1Ev.stub = !0;
      function __ZN6TagLib10FileStream10writeBlockERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib10FileStream10writeBlockERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10FileStream10writeBlockERKNS_10ByteVectorE.stub = !0;
      function __ZN6TagLib10FileStream11removeBlockExm() {
        return wasmImports._ZN6TagLib10FileStream11removeBlockExm.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10FileStream11removeBlockExm.stub = !0;
      function __ZN6TagLib10FileStream4seekExNS_8IOStream8PositionE() {
        return wasmImports._ZN6TagLib10FileStream4seekExNS_8IOStream8PositionE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10FileStream4seekExNS_8IOStream8PositionE.stub = !0;
      function __ZN6TagLib10FileStream5clearEv() {
        return wasmImports._ZN6TagLib10FileStream5clearEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10FileStream5clearEv.stub = !0;
      function __ZN6TagLib10FileStream6insertERKNS_10ByteVectorExm() {
        return wasmImports._ZN6TagLib10FileStream6insertERKNS_10ByteVectorExm.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10FileStream6insertERKNS_10ByteVectorExm.stub = !0;
      function __ZN6TagLib10FileStream6lengthEv() {
        return wasmImports._ZN6TagLib10FileStream6lengthEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10FileStream6lengthEv.stub = !0;
      function __ZN6TagLib10FileStream8truncateEx() {
        return wasmImports._ZN6TagLib10FileStream8truncateEx.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10FileStream8truncateEx.stub = !0;
      function __ZN6TagLib10FileStream9readBlockEm() {
        return wasmImports._ZN6TagLib10FileStream9readBlockEm.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10FileStream9readBlockEm.stub = !0;
      function __ZN6TagLib10FileStreamD0Ev() {
        return wasmImports._ZN6TagLib10FileStreamD0Ev.apply(null, arguments);
      }
      __ZN6TagLib10FileStreamD0Ev.stub = !0;
      function __ZN6TagLib10FileStreamD1Ev() {
        return wasmImports._ZN6TagLib10FileStreamD1Ev.apply(null, arguments);
      }
      __ZN6TagLib10FileStreamD1Ev.stub = !0;
      function __ZN6TagLib10StringList6appendERKNS_6StringE() {
        return wasmImports._ZN6TagLib10StringList6appendERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10StringList6appendERKNS_6StringE.stub = !0;
      function __ZN6TagLib10StringListC1ERKNS_6StringE() {
        return wasmImports._ZN6TagLib10StringListC1ERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10StringListC1ERKNS_6StringE.stub = !0;
      function __ZN6TagLib10StringListC1ERKS0_() {
        return wasmImports._ZN6TagLib10StringListC1ERKS0_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10StringListC1ERKS0_.stub = !0;
      function __ZN6TagLib10StringListC1Ev() {
        return wasmImports._ZN6TagLib10StringListC1Ev.apply(null, arguments);
      }
      __ZN6TagLib10StringListC1Ev.stub = !0;
      function __ZN6TagLib10StringListD1Ev() {
        return wasmImports._ZN6TagLib10StringListD1Ev.apply(null, arguments);
      }
      __ZN6TagLib10StringListD1Ev.stub = !0;
      function __ZN6TagLib10StringListaSERKS0_() {
        return wasmImports._ZN6TagLib10StringListaSERKS0_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib10StringListaSERKS0_.stub = !0;
      function __ZN6TagLib11PropertyMap4findERKNS_6StringE() {
        return wasmImports._ZN6TagLib11PropertyMap4findERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib11PropertyMap4findERKNS_6StringE.stub = !0;
      function __ZN6TagLib11PropertyMap5eraseERKNS_6StringE() {
        return wasmImports._ZN6TagLib11PropertyMap5eraseERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib11PropertyMap5eraseERKNS_6StringE.stub = !0;
      function __ZN6TagLib11PropertyMap6insertERKNS_6StringERKNS_10StringListE() {
        return wasmImports._ZN6TagLib11PropertyMap6insertERKNS_6StringERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib11PropertyMap6insertERKNS_6StringERKNS_10StringListE.stub = !0;
      function __ZN6TagLib11PropertyMapD1Ev() {
        return wasmImports._ZN6TagLib11PropertyMapD1Ev.apply(null, arguments);
      }
      __ZN6TagLib11PropertyMapD1Ev.stub = !0;
      function __ZN6TagLib13DebugListenerD0Ev() {
        return wasmImports._ZN6TagLib13DebugListenerD0Ev.apply(null, arguments);
      }
      __ZN6TagLib13DebugListenerD0Ev.stub = !0;
      function __ZN6TagLib13DebugListenerD1Ev() {
        return wasmImports._ZN6TagLib13DebugListenerD1Ev.apply(null, arguments);
      }
      __ZN6TagLib13DebugListenerD1Ev.stub = !0;
      function __ZN6TagLib13DebugListenerD2Ev() {
        return wasmImports._ZN6TagLib13DebugListenerD2Ev.apply(null, arguments);
      }
      __ZN6TagLib13DebugListenerD2Ev.stub = !0;
      function __ZN6TagLib13debugListenerE() {
        return wasmImports._ZN6TagLib13debugListenerE.apply(null, arguments);
      }
      __ZN6TagLib13debugListenerE.stub = !0;
      function __ZN6TagLib15AudioPropertiesD0Ev() {
        return wasmImports._ZN6TagLib15AudioPropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib15AudioPropertiesD0Ev.stub = !0;
      function __ZN6TagLib15AudioPropertiesD1Ev() {
        return wasmImports._ZN6TagLib15AudioPropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib15AudioPropertiesD1Ev.stub = !0;
      function __ZN6TagLib16ByteVectorStream10writeBlockERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib16ByteVectorStream10writeBlockERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStream10writeBlockERKNS_10ByteVectorE.stub = !0;
      function __ZN6TagLib16ByteVectorStream11removeBlockExm() {
        return wasmImports._ZN6TagLib16ByteVectorStream11removeBlockExm.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStream11removeBlockExm.stub = !0;
      function __ZN6TagLib16ByteVectorStream4seekExNS_8IOStream8PositionE() {
        return wasmImports._ZN6TagLib16ByteVectorStream4seekExNS_8IOStream8PositionE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStream4seekExNS_8IOStream8PositionE.stub = !0;
      function __ZN6TagLib16ByteVectorStream5clearEv() {
        return wasmImports._ZN6TagLib16ByteVectorStream5clearEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStream5clearEv.stub = !0;
      function __ZN6TagLib16ByteVectorStream6insertERKNS_10ByteVectorExm() {
        return wasmImports._ZN6TagLib16ByteVectorStream6insertERKNS_10ByteVectorExm.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStream6insertERKNS_10ByteVectorExm.stub = !0;
      function __ZN6TagLib16ByteVectorStream6lengthEv() {
        return wasmImports._ZN6TagLib16ByteVectorStream6lengthEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStream6lengthEv.stub = !0;
      function __ZN6TagLib16ByteVectorStream8truncateEx() {
        return wasmImports._ZN6TagLib16ByteVectorStream8truncateEx.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStream8truncateEx.stub = !0;
      function __ZN6TagLib16ByteVectorStream9readBlockEm() {
        return wasmImports._ZN6TagLib16ByteVectorStream9readBlockEm.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStream9readBlockEm.stub = !0;
      function __ZN6TagLib16ByteVectorStreamC1ERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib16ByteVectorStreamC1ERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStreamC1ERKNS_10ByteVectorE.stub = !0;
      function __ZN6TagLib16ByteVectorStreamD0Ev() {
        return wasmImports._ZN6TagLib16ByteVectorStreamD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStreamD0Ev.stub = !0;
      function __ZN6TagLib16ByteVectorStreamD1Ev() {
        return wasmImports._ZN6TagLib16ByteVectorStreamD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib16ByteVectorStreamD1Ev.stub = !0;
      function __ZN6TagLib2IT10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib2IT10PropertiesD0Ev.apply(null, arguments);
      }
      __ZN6TagLib2IT10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib2IT10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib2IT10PropertiesD1Ev.apply(null, arguments);
      }
      __ZN6TagLib2IT10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib2IT4File4saveEv() {
        return wasmImports._ZN6TagLib2IT4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib2IT4File4saveEv.stub = !0;
      function __ZN6TagLib2IT4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib2IT4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib2IT4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib2IT4FileD0Ev() {
        return wasmImports._ZN6TagLib2IT4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib2IT4FileD0Ev.stub = !0;
      function __ZN6TagLib2IT4FileD1Ev() {
        return wasmImports._ZN6TagLib2IT4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib2IT4FileD1Ev.stub = !0;
      function __ZN6TagLib2XM10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib2XM10PropertiesD0Ev.apply(null, arguments);
      }
      __ZN6TagLib2XM10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib2XM10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib2XM10PropertiesD1Ev.apply(null, arguments);
      }
      __ZN6TagLib2XM10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib2XM4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib2XM4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib2XM4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib2XM4File4saveEv() {
        return wasmImports._ZN6TagLib2XM4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib2XM4File4saveEv.stub = !0;
      function __ZN6TagLib2XM4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib2XM4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib2XM4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib2XM4FileD0Ev() {
        return wasmImports._ZN6TagLib2XM4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib2XM4FileD0Ev.stub = !0;
      function __ZN6TagLib2XM4FileD1Ev() {
        return wasmImports._ZN6TagLib2XM4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib2XM4FileD1Ev.stub = !0;
      function __ZN6TagLib3APE10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib3APE10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib3APE10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib3APE10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib3APE3Tag10setCommentERKNS_6StringE() {
        return wasmImports._ZN6TagLib3APE3Tag10setCommentERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE3Tag10setCommentERKNS_6StringE.stub = !0;
      function __ZN6TagLib3APE3Tag13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3APE3Tag13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE3Tag13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3APE3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE() {
        return wasmImports._ZN6TagLib3APE3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.stub =
        !0;
      function __ZN6TagLib3APE3Tag27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib3APE3Tag27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE3Tag27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib3APE3Tag7setYearEj() {
        return wasmImports._ZN6TagLib3APE3Tag7setYearEj.apply(null, arguments);
      }
      __ZN6TagLib3APE3Tag7setYearEj.stub = !0;
      function __ZN6TagLib3APE3Tag8setAlbumERKNS_6StringE() {
        return wasmImports._ZN6TagLib3APE3Tag8setAlbumERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE3Tag8setAlbumERKNS_6StringE.stub = !0;
      function __ZN6TagLib3APE3Tag8setGenreERKNS_6StringE() {
        return wasmImports._ZN6TagLib3APE3Tag8setGenreERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE3Tag8setGenreERKNS_6StringE.stub = !0;
      function __ZN6TagLib3APE3Tag8setTitleERKNS_6StringE() {
        return wasmImports._ZN6TagLib3APE3Tag8setTitleERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE3Tag8setTitleERKNS_6StringE.stub = !0;
      function __ZN6TagLib3APE3Tag8setTrackEj() {
        return wasmImports._ZN6TagLib3APE3Tag8setTrackEj.apply(null, arguments);
      }
      __ZN6TagLib3APE3Tag8setTrackEj.stub = !0;
      function __ZN6TagLib3APE3Tag9setArtistERKNS_6StringE() {
        return wasmImports._ZN6TagLib3APE3Tag9setArtistERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE3Tag9setArtistERKNS_6StringE.stub = !0;
      function __ZN6TagLib3APE3TagD0Ev() {
        return wasmImports._ZN6TagLib3APE3TagD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3APE3TagD0Ev.stub = !0;
      function __ZN6TagLib3APE3TagD1Ev() {
        return wasmImports._ZN6TagLib3APE3TagD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3APE3TagD1Ev.stub = !0;
      function __ZN6TagLib3APE4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3APE4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3APE4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib3APE4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib3APE4File4saveEv() {
        return wasmImports._ZN6TagLib3APE4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib3APE4File4saveEv.stub = !0;
      function __ZN6TagLib3APE4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib3APE4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3APE4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib3APE4FileD0Ev() {
        return wasmImports._ZN6TagLib3APE4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3APE4FileD0Ev.stub = !0;
      function __ZN6TagLib3APE4FileD1Ev() {
        return wasmImports._ZN6TagLib3APE4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3APE4FileD1Ev.stub = !0;
      function __ZN6TagLib3APE4ItemD0Ev() {
        return wasmImports._ZN6TagLib3APE4ItemD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3APE4ItemD0Ev.stub = !0;
      function __ZN6TagLib3APE4ItemD1Ev() {
        return wasmImports._ZN6TagLib3APE4ItemD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3APE4ItemD1Ev.stub = !0;
      function __ZN6TagLib3APE6FooterD0Ev() {
        return wasmImports._ZN6TagLib3APE6FooterD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3APE6FooterD0Ev.stub = !0;
      function __ZN6TagLib3APE6FooterD1Ev() {
        return wasmImports._ZN6TagLib3APE6FooterD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3APE6FooterD1Ev.stub = !0;
      function __ZN6TagLib3ASF10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib3ASF10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib3ASF10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib3ASF10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib3ASF3Tag10setCommentERKNS_6StringE() {
        return wasmImports._ZN6TagLib3ASF3Tag10setCommentERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF3Tag10setCommentERKNS_6StringE.stub = !0;
      function __ZN6TagLib3ASF3Tag12setCopyrightERKNS_6StringE() {
        return wasmImports._ZN6TagLib3ASF3Tag12setCopyrightERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF3Tag12setCopyrightERKNS_6StringE.stub = !0;
      function __ZN6TagLib3ASF3Tag13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3ASF3Tag13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF3Tag13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3ASF3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE() {
        return wasmImports._ZN6TagLib3ASF3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.stub =
        !0;
      function __ZN6TagLib3ASF3Tag27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib3ASF3Tag27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF3Tag27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib3ASF3Tag7setYearEj() {
        return wasmImports._ZN6TagLib3ASF3Tag7setYearEj.apply(null, arguments);
      }
      __ZN6TagLib3ASF3Tag7setYearEj.stub = !0;
      function __ZN6TagLib3ASF3Tag8setAlbumERKNS_6StringE() {
        return wasmImports._ZN6TagLib3ASF3Tag8setAlbumERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF3Tag8setAlbumERKNS_6StringE.stub = !0;
      function __ZN6TagLib3ASF3Tag8setGenreERKNS_6StringE() {
        return wasmImports._ZN6TagLib3ASF3Tag8setGenreERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF3Tag8setGenreERKNS_6StringE.stub = !0;
      function __ZN6TagLib3ASF3Tag8setTitleERKNS_6StringE() {
        return wasmImports._ZN6TagLib3ASF3Tag8setTitleERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF3Tag8setTitleERKNS_6StringE.stub = !0;
      function __ZN6TagLib3ASF3Tag8setTrackEj() {
        return wasmImports._ZN6TagLib3ASF3Tag8setTrackEj.apply(null, arguments);
      }
      __ZN6TagLib3ASF3Tag8setTrackEj.stub = !0;
      function __ZN6TagLib3ASF3Tag9setArtistERKNS_6StringE() {
        return wasmImports._ZN6TagLib3ASF3Tag9setArtistERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF3Tag9setArtistERKNS_6StringE.stub = !0;
      function __ZN6TagLib3ASF3Tag9setRatingERKNS_6StringE() {
        return wasmImports._ZN6TagLib3ASF3Tag9setRatingERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF3Tag9setRatingERKNS_6StringE.stub = !0;
      function __ZN6TagLib3ASF3TagD0Ev() {
        return wasmImports._ZN6TagLib3ASF3TagD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3ASF3TagD0Ev.stub = !0;
      function __ZN6TagLib3ASF3TagD1Ev() {
        return wasmImports._ZN6TagLib3ASF3TagD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3ASF3TagD1Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate10BaseObject5parseEPS1_x() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate10BaseObject5parseEPS1_x.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate10BaseObject5parseEPS1_x.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate10BaseObject6renderEPS1_() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate10BaseObject6renderEPS1_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate10BaseObject6renderEPS1_.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate10BaseObjectD0Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate10BaseObjectD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate10BaseObjectD0Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate10BaseObjectD2Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate10BaseObjectD2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate10BaseObjectD2Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate13UnknownObjectD0Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate13UnknownObjectD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate13UnknownObjectD0Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate13UnknownObjectD2Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate13UnknownObjectD2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate13UnknownObjectD2Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate14MetadataObject5parseEPS1_x() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate14MetadataObject5parseEPS1_x.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate14MetadataObject5parseEPS1_x.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate14MetadataObject6renderEPS1_() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate14MetadataObject6renderEPS1_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate14MetadataObject6renderEPS1_.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate14MetadataObjectD0Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate14MetadataObjectD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate14MetadataObjectD0Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate14MetadataObjectD2Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate14MetadataObjectD2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate14MetadataObjectD2Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate15CodecListObject5parseEPS1_x() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate15CodecListObject5parseEPS1_x.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate15CodecListObject5parseEPS1_x.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate15CodecListObjectD0Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate15CodecListObjectD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate15CodecListObjectD0Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate20FilePropertiesObject5parseEPS1_x() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate20FilePropertiesObject5parseEPS1_x.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate20FilePropertiesObject5parseEPS1_x.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectD0Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectD0Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObject5parseEPS1_x() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObject5parseEPS1_x.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObject5parseEPS1_x.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObject6renderEPS1_() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObject6renderEPS1_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObject6renderEPS1_.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectD0Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectD0Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectD2Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectD2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectD2Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObject5parseEPS1_x() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObject5parseEPS1_x.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObject5parseEPS1_x.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObject6renderEPS1_() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObject6renderEPS1_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObject6renderEPS1_.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectD0Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectD0Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectD2Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectD2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectD2Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate22StreamPropertiesObject5parseEPS1_x() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate22StreamPropertiesObject5parseEPS1_x.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate22StreamPropertiesObject5parseEPS1_x.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectD0Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectD0Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObject5parseEPS1_x() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObject5parseEPS1_x.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObject5parseEPS1_x.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObject6renderEPS1_() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObject6renderEPS1_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObject6renderEPS1_.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectD0Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectD0Ev.stub = !0;
      function __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject5parseEPS1_x() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject5parseEPS1_x.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject5parseEPS1_x.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject6renderEPS1_() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject6renderEPS1_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject6renderEPS1_.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectD0Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectD0Ev.stub =
        !0;
      function __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectD2Ev() {
        return wasmImports._ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectD2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectD2Ev.stub =
        !0;
      function __ZN6TagLib3ASF4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3ASF4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3ASF4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib3ASF4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib3ASF4File4saveEv() {
        return wasmImports._ZN6TagLib3ASF4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib3ASF4File4saveEv.stub = !0;
      function __ZN6TagLib3ASF4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib3ASF4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3ASF4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib3ASF4FileD0Ev() {
        return wasmImports._ZN6TagLib3ASF4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3ASF4FileD0Ev.stub = !0;
      function __ZN6TagLib3ASF4FileD1Ev() {
        return wasmImports._ZN6TagLib3ASF4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3ASF4FileD1Ev.stub = !0;
      function __ZN6TagLib3ASF7PictureD0Ev() {
        return wasmImports._ZN6TagLib3ASF7PictureD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3ASF7PictureD0Ev.stub = !0;
      function __ZN6TagLib3ASF7PictureD1Ev() {
        return wasmImports._ZN6TagLib3ASF7PictureD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3ASF7PictureD1Ev.stub = !0;
      function __ZN6TagLib3ASF9AttributeD0Ev() {
        return wasmImports._ZN6TagLib3ASF9AttributeD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3ASF9AttributeD0Ev.stub = !0;
      function __ZN6TagLib3ASF9AttributeD1Ev() {
        return wasmImports._ZN6TagLib3ASF9AttributeD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3ASF9AttributeD1Ev.stub = !0;
      function __ZN6TagLib3DSF10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib3DSF10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3DSF10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib3DSF10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib3DSF10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3DSF10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib3DSF4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3DSF4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3DSF4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3DSF4File4saveEv() {
        return wasmImports._ZN6TagLib3DSF4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib3DSF4File4saveEv.stub = !0;
      function __ZN6TagLib3DSF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE() {
        return wasmImports._ZN6TagLib3DSF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3DSF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.stub =
        !0;
      function __ZN6TagLib3DSF4FileD0Ev() {
        return wasmImports._ZN6TagLib3DSF4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3DSF4FileD0Ev.stub = !0;
      function __ZN6TagLib3DSF4FileD1Ev() {
        return wasmImports._ZN6TagLib3DSF4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3DSF4FileD1Ev.stub = !0;
      function __ZN6TagLib3MP410PropertiesD0Ev() {
        return wasmImports._ZN6TagLib3MP410PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP410PropertiesD0Ev.stub = !0;
      function __ZN6TagLib3MP410PropertiesD1Ev() {
        return wasmImports._ZN6TagLib3MP410PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP410PropertiesD1Ev.stub = !0;
      function __ZN6TagLib3MP411ItemFactory7factoryE() {
        return wasmImports._ZN6TagLib3MP411ItemFactory7factoryE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP411ItemFactory7factoryE.stub = !0;
      function __ZN6TagLib3MP411ItemFactoryD0Ev() {
        return wasmImports._ZN6TagLib3MP411ItemFactoryD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP411ItemFactoryD0Ev.stub = !0;
      function __ZN6TagLib3MP411ItemFactoryD1Ev() {
        return wasmImports._ZN6TagLib3MP411ItemFactoryD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP411ItemFactoryD1Ev.stub = !0;
      function __ZN6TagLib3MP43Tag10setCommentERKNS_6StringE() {
        return wasmImports._ZN6TagLib3MP43Tag10setCommentERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP43Tag10setCommentERKNS_6StringE.stub = !0;
      function __ZN6TagLib3MP43Tag13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3MP43Tag13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP43Tag13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3MP43Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE() {
        return wasmImports._ZN6TagLib3MP43Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP43Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.stub =
        !0;
      function __ZN6TagLib3MP43Tag27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib3MP43Tag27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP43Tag27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib3MP43Tag7setYearEj() {
        return wasmImports._ZN6TagLib3MP43Tag7setYearEj.apply(null, arguments);
      }
      __ZN6TagLib3MP43Tag7setYearEj.stub = !0;
      function __ZN6TagLib3MP43Tag8setAlbumERKNS_6StringE() {
        return wasmImports._ZN6TagLib3MP43Tag8setAlbumERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP43Tag8setAlbumERKNS_6StringE.stub = !0;
      function __ZN6TagLib3MP43Tag8setGenreERKNS_6StringE() {
        return wasmImports._ZN6TagLib3MP43Tag8setGenreERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP43Tag8setGenreERKNS_6StringE.stub = !0;
      function __ZN6TagLib3MP43Tag8setTitleERKNS_6StringE() {
        return wasmImports._ZN6TagLib3MP43Tag8setTitleERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP43Tag8setTitleERKNS_6StringE.stub = !0;
      function __ZN6TagLib3MP43Tag8setTrackEj() {
        return wasmImports._ZN6TagLib3MP43Tag8setTrackEj.apply(null, arguments);
      }
      __ZN6TagLib3MP43Tag8setTrackEj.stub = !0;
      function __ZN6TagLib3MP43Tag9setArtistERKNS_6StringE() {
        return wasmImports._ZN6TagLib3MP43Tag9setArtistERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP43Tag9setArtistERKNS_6StringE.stub = !0;
      function __ZN6TagLib3MP43TagD0Ev() {
        return wasmImports._ZN6TagLib3MP43TagD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3MP43TagD0Ev.stub = !0;
      function __ZN6TagLib3MP43TagD1Ev() {
        return wasmImports._ZN6TagLib3MP43TagD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3MP43TagD1Ev.stub = !0;
      function __ZN6TagLib3MP44File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3MP44File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP44File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3MP44File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib3MP44File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP44File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib3MP44File4saveEv() {
        return wasmImports._ZN6TagLib3MP44File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib3MP44File4saveEv.stub = !0;
      function __ZN6TagLib3MP44FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS0_11ItemFactoryE() {
        return wasmImports._ZN6TagLib3MP44FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS0_11ItemFactoryE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MP44FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS0_11ItemFactoryE.stub =
        !0;
      function __ZN6TagLib3MP44FileD0Ev() {
        return wasmImports._ZN6TagLib3MP44FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3MP44FileD0Ev.stub = !0;
      function __ZN6TagLib3MP44FileD1Ev() {
        return wasmImports._ZN6TagLib3MP44FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3MP44FileD1Ev.stub = !0;
      function __ZN6TagLib3MP44ItemD0Ev() {
        return wasmImports._ZN6TagLib3MP44ItemD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3MP44ItemD0Ev.stub = !0;
      function __ZN6TagLib3MP44ItemD1Ev() {
        return wasmImports._ZN6TagLib3MP44ItemD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3MP44ItemD1Ev.stub = !0;
      function __ZN6TagLib3MP48CoverArtD0Ev() {
        return wasmImports._ZN6TagLib3MP48CoverArtD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3MP48CoverArtD0Ev.stub = !0;
      function __ZN6TagLib3MP48CoverArtD1Ev() {
        return wasmImports._ZN6TagLib3MP48CoverArtD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3MP48CoverArtD1Ev.stub = !0;
      function __ZN6TagLib3MPC10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib3MPC10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MPC10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib3MPC10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib3MPC10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MPC10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib3MPC4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3MPC4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MPC4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3MPC4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib3MPC4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MPC4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib3MPC4File4saveEv() {
        return wasmImports._ZN6TagLib3MPC4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib3MPC4File4saveEv.stub = !0;
      function __ZN6TagLib3MPC4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib3MPC4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MPC4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib3MPC4FileD0Ev() {
        return wasmImports._ZN6TagLib3MPC4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3MPC4FileD0Ev.stub = !0;
      function __ZN6TagLib3MPC4FileD1Ev() {
        return wasmImports._ZN6TagLib3MPC4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3MPC4FileD1Ev.stub = !0;
      function __ZN6TagLib3MapIKNS_6StringENS_3APE4ItemEE6detachEv() {
        return wasmImports._ZN6TagLib3MapIKNS_6StringENS_3APE4ItemEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapIKNS_6StringENS_3APE4ItemEE6detachEv.stub = !0;
      function __ZN6TagLib3MapINS_10ByteVectorENS_4ListIPNS_5ID3v25FrameEEEE6detachEv() {
        return wasmImports._ZN6TagLib3MapINS_10ByteVectorENS_4ListIPNS_5ID3v25FrameEEEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_10ByteVectorENS_4ListIPNS_5ID3v25FrameEEEE6detachEv.stub =
        !0;
      function __ZN6TagLib3MapINS_10ByteVectorENS_6StringEE6detachEv() {
        return wasmImports._ZN6TagLib3MapINS_10ByteVectorENS_6StringEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_10ByteVectorENS_6StringEE6detachEv.stub = !0;
      function __ZN6TagLib3MapINS_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE6detachEv() {
        return wasmImports._ZN6TagLib3MapINS_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE6detachEv.stub =
        !0;
      function __ZN6TagLib3MapINS_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataEixERKS3_() {
        return wasmImports._ZN6TagLib3MapINS_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataEixERKS3_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataEixERKS3_.stub =
        !0;
      function __ZN6TagLib3MapINS_6StringENS_10ByteVectorEE6detachEv() {
        return wasmImports._ZN6TagLib3MapINS_6StringENS_10ByteVectorEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_6StringENS_10ByteVectorEE6detachEv.stub = !0;
      function __ZN6TagLib3MapINS_6StringENS_10StringListEE6detachEv() {
        return wasmImports._ZN6TagLib3MapINS_6StringENS_10StringListEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_6StringENS_10StringListEE6detachEv.stub = !0;
      function __ZN6TagLib3MapINS_6StringENS_3MP44ItemEE6detachEv() {
        return wasmImports._ZN6TagLib3MapINS_6StringENS_3MP44ItemEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_6StringENS_3MP44ItemEE6detachEv.stub = !0;
      function __ZN6TagLib3MapINS_6StringENS_4ListINS_3ASF9AttributeEEEE6detachEv() {
        return wasmImports._ZN6TagLib3MapINS_6StringENS_4ListINS_3ASF9AttributeEEEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_6StringENS_4ListINS_3ASF9AttributeEEEE6detachEv.stub =
        !0;
      function __ZN6TagLib3MapINS_6StringENS_7VariantEE6detachEv() {
        return wasmImports._ZN6TagLib3MapINS_6StringENS_7VariantEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_6StringENS_7VariantEE6detachEv.stub = !0;
      function __ZN6TagLib3MapINS_6StringES1_E6detachEv() {
        return wasmImports._ZN6TagLib3MapINS_6StringES1_E6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_6StringES1_E6detachEv.stub = !0;
      function __ZN6TagLib3MapINS_6StringEiE6insertERKS1_RKi() {
        return wasmImports._ZN6TagLib3MapINS_6StringEiE6insertERKS1_RKi.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapINS_6StringEiE6insertERKS1_RKi.stub = !0;
      function __ZN6TagLib3MapIjNS_10ByteVectorEE5clearEv() {
        return wasmImports._ZN6TagLib3MapIjNS_10ByteVectorEE5clearEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapIjNS_10ByteVectorEE5clearEv.stub = !0;
      function __ZN6TagLib3MapIjNS_10ByteVectorEEixERKj() {
        return wasmImports._ZN6TagLib3MapIjNS_10ByteVectorEEixERKj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3MapIjNS_10ByteVectorEEixERKj.stub = !0;
      function __ZN6TagLib3Mod10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib3Mod10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Mod10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib3Mod10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib3Mod10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Mod10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib3Mod3Tag10setCommentERKNS_6StringE() {
        return wasmImports._ZN6TagLib3Mod3Tag10setCommentERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Mod3Tag10setCommentERKNS_6StringE.stub = !0;
      function __ZN6TagLib3Mod3Tag13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3Mod3Tag13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Mod3Tag13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3Mod3Tag7setYearEj() {
        return wasmImports._ZN6TagLib3Mod3Tag7setYearEj.apply(null, arguments);
      }
      __ZN6TagLib3Mod3Tag7setYearEj.stub = !0;
      function __ZN6TagLib3Mod3Tag8setAlbumERKNS_6StringE() {
        return wasmImports._ZN6TagLib3Mod3Tag8setAlbumERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Mod3Tag8setAlbumERKNS_6StringE.stub = !0;
      function __ZN6TagLib3Mod3Tag8setGenreERKNS_6StringE() {
        return wasmImports._ZN6TagLib3Mod3Tag8setGenreERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Mod3Tag8setGenreERKNS_6StringE.stub = !0;
      function __ZN6TagLib3Mod3Tag8setTitleERKNS_6StringE() {
        return wasmImports._ZN6TagLib3Mod3Tag8setTitleERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Mod3Tag8setTitleERKNS_6StringE.stub = !0;
      function __ZN6TagLib3Mod3Tag8setTrackEj() {
        return wasmImports._ZN6TagLib3Mod3Tag8setTrackEj.apply(null, arguments);
      }
      __ZN6TagLib3Mod3Tag8setTrackEj.stub = !0;
      function __ZN6TagLib3Mod3Tag9setArtistERKNS_6StringE() {
        return wasmImports._ZN6TagLib3Mod3Tag9setArtistERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Mod3Tag9setArtistERKNS_6StringE.stub = !0;
      function __ZN6TagLib3Mod3TagD0Ev() {
        return wasmImports._ZN6TagLib3Mod3TagD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3Mod3TagD0Ev.stub = !0;
      function __ZN6TagLib3Mod3TagD1Ev() {
        return wasmImports._ZN6TagLib3Mod3TagD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3Mod3TagD1Ev.stub = !0;
      function __ZN6TagLib3Mod4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3Mod4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Mod4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3Mod4File4saveEv() {
        return wasmImports._ZN6TagLib3Mod4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib3Mod4File4saveEv.stub = !0;
      function __ZN6TagLib3Mod4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib3Mod4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Mod4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib3Mod4FileD0Ev() {
        return wasmImports._ZN6TagLib3Mod4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3Mod4FileD0Ev.stub = !0;
      function __ZN6TagLib3Mod4FileD1Ev() {
        return wasmImports._ZN6TagLib3Mod4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3Mod4FileD1Ev.stub = !0;
      function __ZN6TagLib3Mod8FileBaseD0Ev() {
        return wasmImports._ZN6TagLib3Mod8FileBaseD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3Mod8FileBaseD0Ev.stub = !0;
      function __ZN6TagLib3Mod8FileBaseD1Ev() {
        return wasmImports._ZN6TagLib3Mod8FileBaseD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3Mod8FileBaseD1Ev.stub = !0;
      function __ZN6TagLib3Ogg10PageHeaderD0Ev() {
        return wasmImports._ZN6TagLib3Ogg10PageHeaderD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg10PageHeaderD0Ev.stub = !0;
      function __ZN6TagLib3Ogg10PageHeaderD1Ev() {
        return wasmImports._ZN6TagLib3Ogg10PageHeaderD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg10PageHeaderD1Ev.stub = !0;
      function __ZN6TagLib3Ogg11XiphComment10setCommentERKNS_6StringE() {
        return wasmImports._ZN6TagLib3Ogg11XiphComment10setCommentERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphComment10setCommentERKNS_6StringE.stub = !0;
      function __ZN6TagLib3Ogg11XiphComment13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3Ogg11XiphComment13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphComment13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3Ogg11XiphComment20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE() {
        return wasmImports._ZN6TagLib3Ogg11XiphComment20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphComment20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.stub =
        !0;
      function __ZN6TagLib3Ogg11XiphComment7setYearEj() {
        return wasmImports._ZN6TagLib3Ogg11XiphComment7setYearEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphComment7setYearEj.stub = !0;
      function __ZN6TagLib3Ogg11XiphComment8setAlbumERKNS_6StringE() {
        return wasmImports._ZN6TagLib3Ogg11XiphComment8setAlbumERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphComment8setAlbumERKNS_6StringE.stub = !0;
      function __ZN6TagLib3Ogg11XiphComment8setGenreERKNS_6StringE() {
        return wasmImports._ZN6TagLib3Ogg11XiphComment8setGenreERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphComment8setGenreERKNS_6StringE.stub = !0;
      function __ZN6TagLib3Ogg11XiphComment8setTitleERKNS_6StringE() {
        return wasmImports._ZN6TagLib3Ogg11XiphComment8setTitleERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphComment8setTitleERKNS_6StringE.stub = !0;
      function __ZN6TagLib3Ogg11XiphComment8setTrackEj() {
        return wasmImports._ZN6TagLib3Ogg11XiphComment8setTrackEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphComment8setTrackEj.stub = !0;
      function __ZN6TagLib3Ogg11XiphComment9setArtistERKNS_6StringE() {
        return wasmImports._ZN6TagLib3Ogg11XiphComment9setArtistERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphComment9setArtistERKNS_6StringE.stub = !0;
      function __ZN6TagLib3Ogg11XiphCommentD0Ev() {
        return wasmImports._ZN6TagLib3Ogg11XiphCommentD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphCommentD0Ev.stub = !0;
      function __ZN6TagLib3Ogg11XiphCommentD1Ev() {
        return wasmImports._ZN6TagLib3Ogg11XiphCommentD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg11XiphCommentD1Ev.stub = !0;
      function __ZN6TagLib3Ogg4FLAC4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3Ogg4FLAC4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg4FLAC4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3Ogg4FLAC4File4saveEv() {
        return wasmImports._ZN6TagLib3Ogg4FLAC4File4saveEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg4FLAC4File4saveEv.stub = !0;
      function __ZN6TagLib3Ogg4FLAC4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib3Ogg4FLAC4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg4FLAC4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib3Ogg4FLAC4FileD0Ev() {
        return wasmImports._ZN6TagLib3Ogg4FLAC4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3Ogg4FLAC4FileD0Ev.stub = !0;
      function __ZN6TagLib3Ogg4FLAC4FileD1Ev() {
        return wasmImports._ZN6TagLib3Ogg4FLAC4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3Ogg4FLAC4FileD1Ev.stub = !0;
      function __ZN6TagLib3Ogg4File4saveEv() {
        return wasmImports._ZN6TagLib3Ogg4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib3Ogg4File4saveEv.stub = !0;
      function __ZN6TagLib3Ogg4FileD0Ev() {
        return wasmImports._ZN6TagLib3Ogg4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3Ogg4FileD0Ev.stub = !0;
      function __ZN6TagLib3Ogg4FileD1Ev() {
        return wasmImports._ZN6TagLib3Ogg4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3Ogg4FileD1Ev.stub = !0;
      function __ZN6TagLib3Ogg4Opus10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib3Ogg4Opus10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg4Opus10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib3Ogg4Opus10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib3Ogg4Opus10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg4Opus10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib3Ogg4Opus4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3Ogg4Opus4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg4Opus4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3Ogg4Opus4File4saveEv() {
        return wasmImports._ZN6TagLib3Ogg4Opus4File4saveEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg4Opus4File4saveEv.stub = !0;
      function __ZN6TagLib3Ogg4Opus4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib3Ogg4Opus4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg4Opus4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib3Ogg4Opus4FileD0Ev() {
        return wasmImports._ZN6TagLib3Ogg4Opus4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3Ogg4Opus4FileD0Ev.stub = !0;
      function __ZN6TagLib3Ogg4Opus4FileD1Ev() {
        return wasmImports._ZN6TagLib3Ogg4Opus4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3Ogg4Opus4FileD1Ev.stub = !0;
      function __ZN6TagLib3Ogg4PageD0Ev() {
        return wasmImports._ZN6TagLib3Ogg4PageD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3Ogg4PageD0Ev.stub = !0;
      function __ZN6TagLib3Ogg4PageD1Ev() {
        return wasmImports._ZN6TagLib3Ogg4PageD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3Ogg4PageD1Ev.stub = !0;
      function __ZN6TagLib3Ogg5Speex10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib3Ogg5Speex10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg5Speex10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib3Ogg5Speex10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib3Ogg5Speex10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg5Speex10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib3Ogg5Speex4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3Ogg5Speex4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg5Speex4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3Ogg5Speex4File4saveEv() {
        return wasmImports._ZN6TagLib3Ogg5Speex4File4saveEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg5Speex4File4saveEv.stub = !0;
      function __ZN6TagLib3Ogg5Speex4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib3Ogg5Speex4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Ogg5Speex4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub =
        !0;
      function __ZN6TagLib3Ogg5Speex4FileD0Ev() {
        return wasmImports._ZN6TagLib3Ogg5Speex4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3Ogg5Speex4FileD0Ev.stub = !0;
      function __ZN6TagLib3Ogg5Speex4FileD1Ev() {
        return wasmImports._ZN6TagLib3Ogg5Speex4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3Ogg5Speex4FileD1Ev.stub = !0;
      function __ZN6TagLib3S3M10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib3S3M10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3S3M10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib3S3M10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib3S3M10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3S3M10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib3S3M4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3S3M4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3S3M4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3S3M4File4saveEv() {
        return wasmImports._ZN6TagLib3S3M4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib3S3M4File4saveEv.stub = !0;
      function __ZN6TagLib3S3M4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib3S3M4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3S3M4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib3S3M4FileD0Ev() {
        return wasmImports._ZN6TagLib3S3M4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3S3M4FileD0Ev.stub = !0;
      function __ZN6TagLib3S3M4FileD1Ev() {
        return wasmImports._ZN6TagLib3S3M4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3S3M4FileD1Ev.stub = !0;
      function __ZN6TagLib3Tag13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib3Tag13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Tag13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE() {
        return wasmImports._ZN6TagLib3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE.stub =
        !0;
      function __ZN6TagLib3Tag27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib3Tag27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib3Tag27removeUnsupportedPropertiesERKNS_10StringListE.stub = !0;
      function __ZN6TagLib3TagD0Ev() {
        return wasmImports._ZN6TagLib3TagD0Ev.apply(null, arguments);
      }
      __ZN6TagLib3TagD0Ev.stub = !0;
      function __ZN6TagLib3TagD1Ev() {
        return wasmImports._ZN6TagLib3TagD1Ev.apply(null, arguments);
      }
      __ZN6TagLib3TagD1Ev.stub = !0;
      function __ZN6TagLib4FLAC10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib4FLAC10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4FLAC10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib4FLAC10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib4FLAC10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4FLAC10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib4FLAC13MetadataBlockD0Ev() {
        return wasmImports._ZN6TagLib4FLAC13MetadataBlockD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4FLAC13MetadataBlockD0Ev.stub = !0;
      function __ZN6TagLib4FLAC13MetadataBlockD1Ev() {
        return wasmImports._ZN6TagLib4FLAC13MetadataBlockD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4FLAC13MetadataBlockD1Ev.stub = !0;
      function __ZN6TagLib4FLAC20UnknownMetadataBlockD0Ev() {
        return wasmImports._ZN6TagLib4FLAC20UnknownMetadataBlockD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4FLAC20UnknownMetadataBlockD0Ev.stub = !0;
      function __ZN6TagLib4FLAC20UnknownMetadataBlockD1Ev() {
        return wasmImports._ZN6TagLib4FLAC20UnknownMetadataBlockD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4FLAC20UnknownMetadataBlockD1Ev.stub = !0;
      function __ZN6TagLib4FLAC4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib4FLAC4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4FLAC4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib4FLAC4File20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE() {
        return wasmImports._ZN6TagLib4FLAC4File20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4FLAC4File20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.stub =
        !0;
      function __ZN6TagLib4FLAC4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib4FLAC4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4FLAC4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib4FLAC4File4saveEv() {
        return wasmImports._ZN6TagLib4FLAC4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib4FLAC4File4saveEv.stub = !0;
      function __ZN6TagLib4FLAC4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE() {
        return wasmImports._ZN6TagLib4FLAC4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4FLAC4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.stub =
        !0;
      function __ZN6TagLib4FLAC4FileD0Ev() {
        return wasmImports._ZN6TagLib4FLAC4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib4FLAC4FileD0Ev.stub = !0;
      function __ZN6TagLib4FLAC4FileD1Ev() {
        return wasmImports._ZN6TagLib4FLAC4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib4FLAC4FileD1Ev.stub = !0;
      function __ZN6TagLib4FLAC7PictureD0Ev() {
        return wasmImports._ZN6TagLib4FLAC7PictureD0Ev.apply(null, arguments);
      }
      __ZN6TagLib4FLAC7PictureD0Ev.stub = !0;
      function __ZN6TagLib4FLAC7PictureD1Ev() {
        return wasmImports._ZN6TagLib4FLAC7PictureD1Ev.apply(null, arguments);
      }
      __ZN6TagLib4FLAC7PictureD1Ev.stub = !0;
      function __ZN6TagLib4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib4File20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE() {
        return wasmImports._ZN6TagLib4File20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4File20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE.stub =
        !0;
      function __ZN6TagLib4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib4FileD0Ev() {
        return wasmImports._ZN6TagLib4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib4FileD0Ev.stub = !0;
      function __ZN6TagLib4FileD1Ev() {
        return wasmImports._ZN6TagLib4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib4FileD1Ev.stub = !0;
      function __ZN6TagLib4FileD2Ev() {
        return wasmImports._ZN6TagLib4FileD2Ev.apply(null, arguments);
      }
      __ZN6TagLib4FileD2Ev.stub = !0;
      function __ZN6TagLib4ListINS_10ByteVectorEE6appendERKS2_() {
        return wasmImports._ZN6TagLib4ListINS_10ByteVectorEE6appendERKS2_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_10ByteVectorEE6appendERKS2_.stub = !0;
      function __ZN6TagLib4ListINS_10ByteVectorEE6detachEv() {
        return wasmImports._ZN6TagLib4ListINS_10ByteVectorEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_10ByteVectorEE6detachEv.stub = !0;
      function __ZN6TagLib4ListINS_10ByteVectorEEaSESt16initializer_listIS1_E() {
        return wasmImports._ZN6TagLib4ListINS_10ByteVectorEEaSESt16initializer_listIS1_E.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_10ByteVectorEEaSESt16initializer_listIS1_E.stub = !0;
      function __ZN6TagLib4ListINS_3APE4ItemEE6detachEv() {
        return wasmImports._ZN6TagLib4ListINS_3APE4ItemEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_3APE4ItemEE6detachEv.stub = !0;
      function __ZN6TagLib4ListINS_3ASF9AttributeEE6detachEv() {
        return wasmImports._ZN6TagLib4ListINS_3ASF9AttributeEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_3ASF9AttributeEE6detachEv.stub = !0;
      function __ZN6TagLib4ListINS_3MP48AtomDataEE6detachEv() {
        return wasmImports._ZN6TagLib4ListINS_3MP48AtomDataEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_3MP48AtomDataEE6detachEv.stub = !0;
      function __ZN6TagLib4ListINS_3MP48CoverArtEE6detachEv() {
        return wasmImports._ZN6TagLib4ListINS_3MP48CoverArtEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_3MP48CoverArtEE6detachEv.stub = !0;
      function __ZN6TagLib4ListINS_3MapINS_6StringENS_7VariantEEEE6detachEv() {
        return wasmImports._ZN6TagLib4ListINS_3MapINS_6StringENS_7VariantEEEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_3MapINS_6StringENS_7VariantEEEE6detachEv.stub = !0;
      function __ZN6TagLib4ListINS_5ID3v219RelativeVolumeFrame11ChannelTypeEE6detachEv() {
        return wasmImports._ZN6TagLib4ListINS_5ID3v219RelativeVolumeFrame11ChannelTypeEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_5ID3v219RelativeVolumeFrame11ChannelTypeEE6detachEv.stub =
        !0;
      function __ZN6TagLib4ListINS_5ID3v221EventTimingCodesFrame12SynchedEventEE6detachEv() {
        return wasmImports._ZN6TagLib4ListINS_5ID3v221EventTimingCodesFrame12SynchedEventEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_5ID3v221EventTimingCodesFrame12SynchedEventEE6detachEv.stub =
        !0;
      function __ZN6TagLib4ListINS_5ID3v223SynchronizedLyricsFrame11SynchedTextEE6detachEv() {
        return wasmImports._ZN6TagLib4ListINS_5ID3v223SynchronizedLyricsFrame11SynchedTextEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_5ID3v223SynchronizedLyricsFrame11SynchedTextEE6detachEv.stub =
        !0;
      function __ZN6TagLib4ListINS_6StringEE6appendERKS2_() {
        return wasmImports._ZN6TagLib4ListINS_6StringEE6appendERKS2_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_6StringEE6appendERKS2_.stub = !0;
      function __ZN6TagLib4ListINS_6StringEE6detachEv() {
        return wasmImports._ZN6TagLib4ListINS_6StringEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_6StringEE6detachEv.stub = !0;
      function __ZN6TagLib4ListINS_6StringEEaSESt16initializer_listIS1_E() {
        return wasmImports._ZN6TagLib4ListINS_6StringEEaSESt16initializer_listIS1_E.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListINS_6StringEEaSESt16initializer_listIS1_E.stub = !0;
      function __ZN6TagLib4ListIPKNS_7FileRef16FileTypeResolverEE11ListPrivateIS4_ED2Ev() {
        return wasmImports._ZN6TagLib4ListIPKNS_7FileRef16FileTypeResolverEE11ListPrivateIS4_ED2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPKNS_7FileRef16FileTypeResolverEE11ListPrivateIS4_ED2Ev.stub =
        !0;
      function __ZN6TagLib4ListIPKNS_7FileRef16FileTypeResolverEE6detachEv() {
        return wasmImports._ZN6TagLib4ListIPKNS_7FileRef16FileTypeResolverEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPKNS_7FileRef16FileTypeResolverEE6detachEv.stub = !0;
      function __ZN6TagLib4ListIPNS_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS5_ED2Ev() {
        return wasmImports._ZN6TagLib4ListIPNS_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS5_ED2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS5_ED2Ev.stub =
        !0;
      function __ZN6TagLib4ListIPNS_3ASF4File11FilePrivate10BaseObjectEE6detachEv() {
        return wasmImports._ZN6TagLib4ListIPNS_3ASF4File11FilePrivate10BaseObjectEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_3ASF4File11FilePrivate10BaseObjectEE6detachEv.stub =
        !0;
      function __ZN6TagLib4ListIPNS_3MP44AtomEE11ListPrivateIS3_ED2Ev() {
        return wasmImports._ZN6TagLib4ListIPNS_3MP44AtomEE11ListPrivateIS3_ED2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_3MP44AtomEE11ListPrivateIS3_ED2Ev.stub = !0;
      function __ZN6TagLib4ListIPNS_3MP44AtomEE6detachEv() {
        return wasmImports._ZN6TagLib4ListIPNS_3MP44AtomEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_3MP44AtomEE6detachEv.stub = !0;
      function __ZN6TagLib4ListIPNS_3Ogg4PageEE11ListPrivateIS3_ED2Ev() {
        return wasmImports._ZN6TagLib4ListIPNS_3Ogg4PageEE11ListPrivateIS3_ED2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_3Ogg4PageEE11ListPrivateIS3_ED2Ev.stub = !0;
      function __ZN6TagLib4ListIPNS_3Ogg4PageEE6detachEv() {
        return wasmImports._ZN6TagLib4ListIPNS_3Ogg4PageEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_3Ogg4PageEE6detachEv.stub = !0;
      function __ZN6TagLib4ListIPNS_4FLAC13MetadataBlockEE11ListPrivateIS3_ED2Ev() {
        return wasmImports._ZN6TagLib4ListIPNS_4FLAC13MetadataBlockEE11ListPrivateIS3_ED2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_4FLAC13MetadataBlockEE11ListPrivateIS3_ED2Ev.stub =
        !0;
      function __ZN6TagLib4ListIPNS_4FLAC13MetadataBlockEE6detachEv() {
        return wasmImports._ZN6TagLib4ListIPNS_4FLAC13MetadataBlockEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_4FLAC13MetadataBlockEE6detachEv.stub = !0;
      function __ZN6TagLib4ListIPNS_4FLAC7PictureEE11ListPrivateIS3_ED2Ev() {
        return wasmImports._ZN6TagLib4ListIPNS_4FLAC7PictureEE11ListPrivateIS3_ED2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_4FLAC7PictureEE11ListPrivateIS3_ED2Ev.stub = !0;
      function __ZN6TagLib4ListIPNS_4FLAC7PictureEE6detachEv() {
        return wasmImports._ZN6TagLib4ListIPNS_4FLAC7PictureEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_4FLAC7PictureEE6detachEv.stub = !0;
      function __ZN6TagLib4ListIPNS_5ID3v25FrameEE11ListPrivateIS3_ED2Ev() {
        return wasmImports._ZN6TagLib4ListIPNS_5ID3v25FrameEE11ListPrivateIS3_ED2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_5ID3v25FrameEE11ListPrivateIS3_ED2Ev.stub = !0;
      function __ZN6TagLib4ListIPNS_5ID3v25FrameEE6appendERKS3_() {
        return wasmImports._ZN6TagLib4ListIPNS_5ID3v25FrameEE6appendERKS3_.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_5ID3v25FrameEE6appendERKS3_.stub = !0;
      function __ZN6TagLib4ListIPNS_5ID3v25FrameEE6detachEv() {
        return wasmImports._ZN6TagLib4ListIPNS_5ID3v25FrameEE6detachEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPNS_5ID3v25FrameEE6detachEv.stub = !0;
      function __ZN6TagLib4ListIPcE11ListPrivateIS1_ED2Ev() {
        return wasmImports._ZN6TagLib4ListIPcE11ListPrivateIS1_ED2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4ListIPcE11ListPrivateIS1_ED2Ev.stub = !0;
      function __ZN6TagLib4ListIPcE6detachEv() {
        return wasmImports._ZN6TagLib4ListIPcE6detachEv.apply(null, arguments);
      }
      __ZN6TagLib4ListIPcE6detachEv.stub = !0;
      function __ZN6TagLib4ListIiE6detachEv() {
        return wasmImports._ZN6TagLib4ListIiE6detachEv.apply(null, arguments);
      }
      __ZN6TagLib4ListIiE6detachEv.stub = !0;
      function __ZN6TagLib4MPEG10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib4MPEG10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4MPEG10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib4MPEG10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib4MPEG10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4MPEG10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib4MPEG10XingHeaderD0Ev() {
        return wasmImports._ZN6TagLib4MPEG10XingHeaderD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4MPEG10XingHeaderD0Ev.stub = !0;
      function __ZN6TagLib4MPEG10XingHeaderD1Ev() {
        return wasmImports._ZN6TagLib4MPEG10XingHeaderD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4MPEG10XingHeaderD1Ev.stub = !0;
      function __ZN6TagLib4MPEG4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib4MPEG4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4MPEG4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib4MPEG4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib4MPEG4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4MPEG4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib4MPEG4File4saveEv() {
        return wasmImports._ZN6TagLib4MPEG4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib4MPEG4File4saveEv.stub = !0;
      function __ZN6TagLib4MPEG4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE() {
        return wasmImports._ZN6TagLib4MPEG4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4MPEG4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.stub =
        !0;
      function __ZN6TagLib4MPEG4FileD0Ev() {
        return wasmImports._ZN6TagLib4MPEG4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib4MPEG4FileD0Ev.stub = !0;
      function __ZN6TagLib4MPEG4FileD1Ev() {
        return wasmImports._ZN6TagLib4MPEG4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib4MPEG4FileD1Ev.stub = !0;
      function __ZN6TagLib4MPEG6HeaderD0Ev() {
        return wasmImports._ZN6TagLib4MPEG6HeaderD0Ev.apply(null, arguments);
      }
      __ZN6TagLib4MPEG6HeaderD0Ev.stub = !0;
      function __ZN6TagLib4MPEG6HeaderD1Ev() {
        return wasmImports._ZN6TagLib4MPEG6HeaderD1Ev.apply(null, arguments);
      }
      __ZN6TagLib4MPEG6HeaderD1Ev.stub = !0;
      function __ZN6TagLib4RIFF3WAV10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib4RIFF3WAV10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF3WAV10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib4RIFF3WAV10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib4RIFF3WAV10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF3WAV10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib4RIFF3WAV4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib4RIFF3WAV4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF3WAV4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib4RIFF3WAV4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib4RIFF3WAV4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF3WAV4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib4RIFF3WAV4File4saveEv() {
        return wasmImports._ZN6TagLib4RIFF3WAV4File4saveEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF3WAV4File4saveEv.stub = !0;
      function __ZN6TagLib4RIFF3WAV4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE() {
        return wasmImports._ZN6TagLib4RIFF3WAV4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF3WAV4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.stub =
        !0;
      function __ZN6TagLib4RIFF3WAV4FileD0Ev() {
        return wasmImports._ZN6TagLib4RIFF3WAV4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib4RIFF3WAV4FileD0Ev.stub = !0;
      function __ZN6TagLib4RIFF3WAV4FileD1Ev() {
        return wasmImports._ZN6TagLib4RIFF3WAV4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib4RIFF3WAV4FileD1Ev.stub = !0;
      function __ZN6TagLib4RIFF4AIFF10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib4RIFF4AIFF10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4AIFF10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib4RIFF4AIFF10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib4RIFF4AIFF10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4AIFF10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib4RIFF4AIFF4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib4RIFF4AIFF4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4AIFF4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib4RIFF4AIFF4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib4RIFF4AIFF4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4AIFF4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib4RIFF4AIFF4File4saveEv() {
        return wasmImports._ZN6TagLib4RIFF4AIFF4File4saveEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4AIFF4File4saveEv.stub = !0;
      function __ZN6TagLib4RIFF4AIFF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE() {
        return wasmImports._ZN6TagLib4RIFF4AIFF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4AIFF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.stub =
        !0;
      function __ZN6TagLib4RIFF4AIFF4FileD0Ev() {
        return wasmImports._ZN6TagLib4RIFF4AIFF4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib4RIFF4AIFF4FileD0Ev.stub = !0;
      function __ZN6TagLib4RIFF4AIFF4FileD1Ev() {
        return wasmImports._ZN6TagLib4RIFF4AIFF4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib4RIFF4AIFF4FileD1Ev.stub = !0;
      function __ZN6TagLib4RIFF4FileD0Ev() {
        return wasmImports._ZN6TagLib4RIFF4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib4RIFF4FileD0Ev.stub = !0;
      function __ZN6TagLib4RIFF4FileD1Ev() {
        return wasmImports._ZN6TagLib4RIFF4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib4RIFF4FileD1Ev.stub = !0;
      function __ZN6TagLib4RIFF4Info13StringHandlerD0Ev() {
        return wasmImports._ZN6TagLib4RIFF4Info13StringHandlerD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info13StringHandlerD0Ev.stub = !0;
      function __ZN6TagLib4RIFF4Info13StringHandlerD1Ev() {
        return wasmImports._ZN6TagLib4RIFF4Info13StringHandlerD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info13StringHandlerD1Ev.stub = !0;
      function __ZN6TagLib4RIFF4Info3Tag10setCommentERKNS_6StringE() {
        return wasmImports._ZN6TagLib4RIFF4Info3Tag10setCommentERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info3Tag10setCommentERKNS_6StringE.stub = !0;
      function __ZN6TagLib4RIFF4Info3Tag13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib4RIFF4Info3Tag13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info3Tag13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib4RIFF4Info3Tag27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib4RIFF4Info3Tag27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info3Tag27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib4RIFF4Info3Tag7setYearEj() {
        return wasmImports._ZN6TagLib4RIFF4Info3Tag7setYearEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info3Tag7setYearEj.stub = !0;
      function __ZN6TagLib4RIFF4Info3Tag8setAlbumERKNS_6StringE() {
        return wasmImports._ZN6TagLib4RIFF4Info3Tag8setAlbumERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info3Tag8setAlbumERKNS_6StringE.stub = !0;
      function __ZN6TagLib4RIFF4Info3Tag8setGenreERKNS_6StringE() {
        return wasmImports._ZN6TagLib4RIFF4Info3Tag8setGenreERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info3Tag8setGenreERKNS_6StringE.stub = !0;
      function __ZN6TagLib4RIFF4Info3Tag8setTitleERKNS_6StringE() {
        return wasmImports._ZN6TagLib4RIFF4Info3Tag8setTitleERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info3Tag8setTitleERKNS_6StringE.stub = !0;
      function __ZN6TagLib4RIFF4Info3Tag8setTrackEj() {
        return wasmImports._ZN6TagLib4RIFF4Info3Tag8setTrackEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info3Tag8setTrackEj.stub = !0;
      function __ZN6TagLib4RIFF4Info3Tag9setArtistERKNS_6StringE() {
        return wasmImports._ZN6TagLib4RIFF4Info3Tag9setArtistERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib4RIFF4Info3Tag9setArtistERKNS_6StringE.stub = !0;
      function __ZN6TagLib4RIFF4Info3TagD0Ev() {
        return wasmImports._ZN6TagLib4RIFF4Info3TagD0Ev.apply(null, arguments);
      }
      __ZN6TagLib4RIFF4Info3TagD0Ev.stub = !0;
      function __ZN6TagLib4RIFF4Info3TagD1Ev() {
        return wasmImports._ZN6TagLib4RIFF4Info3TagD1Ev.apply(null, arguments);
      }
      __ZN6TagLib4RIFF4Info3TagD1Ev.stub = !0;
      function __ZN6TagLib5ID3v113StringHandlerD0Ev() {
        return wasmImports._ZN6TagLib5ID3v113StringHandlerD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v113StringHandlerD0Ev.stub = !0;
      function __ZN6TagLib5ID3v113StringHandlerD1Ev() {
        return wasmImports._ZN6TagLib5ID3v113StringHandlerD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v113StringHandlerD1Ev.stub = !0;
      function __ZN6TagLib5ID3v13Tag10setCommentERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v13Tag10setCommentERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v13Tag10setCommentERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v13Tag7setYearEj() {
        return wasmImports._ZN6TagLib5ID3v13Tag7setYearEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v13Tag7setYearEj.stub = !0;
      function __ZN6TagLib5ID3v13Tag8setAlbumERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v13Tag8setAlbumERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v13Tag8setAlbumERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v13Tag8setGenreERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v13Tag8setGenreERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v13Tag8setGenreERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v13Tag8setTitleERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v13Tag8setTitleERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v13Tag8setTitleERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v13Tag8setTrackEj() {
        return wasmImports._ZN6TagLib5ID3v13Tag8setTrackEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v13Tag8setTrackEj.stub = !0;
      function __ZN6TagLib5ID3v13Tag9setArtistERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v13Tag9setArtistERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v13Tag9setArtistERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v13TagD0Ev() {
        return wasmImports._ZN6TagLib5ID3v13TagD0Ev.apply(null, arguments);
      }
      __ZN6TagLib5ID3v13TagD0Ev.stub = !0;
      function __ZN6TagLib5ID3v13TagD1Ev() {
        return wasmImports._ZN6TagLib5ID3v13TagD1Ev.apply(null, arguments);
      }
      __ZN6TagLib5ID3v13TagD1Ev.stub = !0;
      function __ZN6TagLib5ID3v212ChapterFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v212ChapterFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212ChapterFrame11parseFieldsERKNS_10ByteVectorE.stub = !0;
      function __ZN6TagLib5ID3v212ChapterFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v212ChapterFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212ChapterFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v212ChapterFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v212ChapterFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212ChapterFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v212FrameFactory22setDefaultTextEncodingENS_6String4TypeE() {
        return wasmImports._ZN6TagLib5ID3v212FrameFactory22setDefaultTextEncodingENS_6String4TypeE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212FrameFactory22setDefaultTextEncodingENS_6String4TypeE.stub =
        !0;
      function __ZN6TagLib5ID3v212FrameFactory7factoryE() {
        return wasmImports._ZN6TagLib5ID3v212FrameFactory7factoryE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212FrameFactory7factoryE.stub = !0;
      function __ZN6TagLib5ID3v212FrameFactory8instanceEv() {
        return wasmImports._ZN6TagLib5ID3v212FrameFactory8instanceEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212FrameFactory8instanceEv.stub = !0;
      function __ZN6TagLib5ID3v212FrameFactoryD0Ev() {
        return wasmImports._ZN6TagLib5ID3v212FrameFactoryD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212FrameFactoryD0Ev.stub = !0;
      function __ZN6TagLib5ID3v212FrameFactoryD1Ev() {
        return wasmImports._ZN6TagLib5ID3v212FrameFactoryD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212FrameFactoryD1Ev.stub = !0;
      function __ZN6TagLib5ID3v212PodcastFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v212PodcastFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212PodcastFrame11parseFieldsERKNS_10ByteVectorE.stub = !0;
      function __ZN6TagLib5ID3v212PodcastFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v212PodcastFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212PodcastFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v212PodcastFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v212PodcastFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212PodcastFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v212PrivateFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v212PrivateFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212PrivateFrame11parseFieldsERKNS_10ByteVectorE.stub = !0;
      function __ZN6TagLib5ID3v212PrivateFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v212PrivateFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212PrivateFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v212PrivateFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v212PrivateFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212PrivateFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v212UnknownFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v212UnknownFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212UnknownFrame11parseFieldsERKNS_10ByteVectorE.stub = !0;
      function __ZN6TagLib5ID3v212UnknownFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v212UnknownFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212UnknownFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v212UnknownFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v212UnknownFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212UnknownFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v212UrlLinkFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v212UrlLinkFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212UrlLinkFrame11parseFieldsERKNS_10ByteVectorE.stub = !0;
      function __ZN6TagLib5ID3v212UrlLinkFrame6setUrlERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v212UrlLinkFrame6setUrlERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212UrlLinkFrame6setUrlERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v212UrlLinkFrame7setTextERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v212UrlLinkFrame7setTextERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212UrlLinkFrame7setTextERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v212UrlLinkFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v212UrlLinkFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212UrlLinkFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v212UrlLinkFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v212UrlLinkFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v212UrlLinkFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v213CommentsFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v213CommentsFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v213CommentsFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v213CommentsFrame7setTextERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v213CommentsFrame7setTextERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v213CommentsFrame7setTextERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v213CommentsFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v213CommentsFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v213CommentsFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v213CommentsFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v213CommentsFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v213CommentsFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v214ExtendedHeaderD0Ev() {
        return wasmImports._ZN6TagLib5ID3v214ExtendedHeaderD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v214ExtendedHeaderD0Ev.stub = !0;
      function __ZN6TagLib5ID3v214ExtendedHeaderD1Ev() {
        return wasmImports._ZN6TagLib5ID3v214ExtendedHeaderD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v214ExtendedHeaderD1Ev.stub = !0;
      function __ZN6TagLib5ID3v214OwnershipFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v214OwnershipFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v214OwnershipFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v214OwnershipFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v214OwnershipFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v214OwnershipFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v214OwnershipFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v214OwnershipFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v214OwnershipFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v216UserUrlLinkFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v216UserUrlLinkFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v216UserUrlLinkFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v216UserUrlLinkFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v216UserUrlLinkFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v216UserUrlLinkFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v216UserUrlLinkFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v216UserUrlLinkFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v216UserUrlLinkFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v218PopularimeterFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v218PopularimeterFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v218PopularimeterFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v218PopularimeterFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v218PopularimeterFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v218PopularimeterFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v218PopularimeterFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v218PopularimeterFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v218PopularimeterFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v219Latin1StringHandlerD0Ev() {
        return wasmImports._ZN6TagLib5ID3v219Latin1StringHandlerD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v219Latin1StringHandlerD0Ev.stub = !0;
      function __ZN6TagLib5ID3v219Latin1StringHandlerD1Ev() {
        return wasmImports._ZN6TagLib5ID3v219Latin1StringHandlerD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v219Latin1StringHandlerD1Ev.stub = !0;
      function __ZN6TagLib5ID3v219RelativeVolumeFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v219RelativeVolumeFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v219RelativeVolumeFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v219RelativeVolumeFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v219RelativeVolumeFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v219RelativeVolumeFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v219RelativeVolumeFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v219RelativeVolumeFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v219RelativeVolumeFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v220AttachedPictureFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v220AttachedPictureFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v220AttachedPictureFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v220AttachedPictureFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v220AttachedPictureFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v220AttachedPictureFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v220AttachedPictureFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v220AttachedPictureFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v220AttachedPictureFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v220AttachedPictureFrameD2Ev() {
        return wasmImports._ZN6TagLib5ID3v220AttachedPictureFrameD2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v220AttachedPictureFrameD2Ev.stub = !0;
      function __ZN6TagLib5ID3v220TableOfContentsFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v220TableOfContentsFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v220TableOfContentsFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v220TableOfContentsFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v220TableOfContentsFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v220TableOfContentsFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v220TableOfContentsFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v220TableOfContentsFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v220TableOfContentsFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v221EventTimingCodesFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v221EventTimingCodesFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v221EventTimingCodesFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v221EventTimingCodesFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v221EventTimingCodesFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v221EventTimingCodesFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v221EventTimingCodesFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v221EventTimingCodesFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v221EventTimingCodesFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v223AttachedPictureFrameV2211parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v223AttachedPictureFrameV2211parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v223AttachedPictureFrameV2211parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v223AttachedPictureFrameV22D0Ev() {
        return wasmImports._ZN6TagLib5ID3v223AttachedPictureFrameV22D0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v223AttachedPictureFrameV22D0Ev.stub = !0;
      function __ZN6TagLib5ID3v223SynchronizedLyricsFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v223SynchronizedLyricsFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v223SynchronizedLyricsFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v223SynchronizedLyricsFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v223SynchronizedLyricsFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v223SynchronizedLyricsFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v223SynchronizedLyricsFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v223SynchronizedLyricsFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v223SynchronizedLyricsFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v223TextIdentificationFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v223TextIdentificationFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v223TextIdentificationFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v223TextIdentificationFrame7setTextERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v223TextIdentificationFrame7setTextERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v223TextIdentificationFrame7setTextERKNS_6StringE.stub =
        !0;
      function __ZN6TagLib5ID3v223TextIdentificationFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v223TextIdentificationFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v223TextIdentificationFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v223TextIdentificationFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v223TextIdentificationFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v223TextIdentificationFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v225UniqueFileIdentifierFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v225UniqueFileIdentifierFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v225UniqueFileIdentifierFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v225UniqueFileIdentifierFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v225UniqueFileIdentifierFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v225UniqueFileIdentifierFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v225UniqueFileIdentifierFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v225UniqueFileIdentifierFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v225UniqueFileIdentifierFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v225UnsynchronizedLyricsFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v225UnsynchronizedLyricsFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v225UnsynchronizedLyricsFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v225UnsynchronizedLyricsFrame7setTextERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v225UnsynchronizedLyricsFrame7setTextERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v225UnsynchronizedLyricsFrame7setTextERKNS_6StringE.stub =
        !0;
      function __ZN6TagLib5ID3v225UnsynchronizedLyricsFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v225UnsynchronizedLyricsFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v225UnsynchronizedLyricsFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v225UnsynchronizedLyricsFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v225UnsynchronizedLyricsFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v225UnsynchronizedLyricsFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v227UserTextIdentificationFrame7setTextERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v227UserTextIdentificationFrame7setTextERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v227UserTextIdentificationFrame7setTextERKNS_6StringE.stub =
        !0;
      function __ZN6TagLib5ID3v227UserTextIdentificationFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v227UserTextIdentificationFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v227UserTextIdentificationFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v227UserTextIdentificationFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v227UserTextIdentificationFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v227UserTextIdentificationFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrame11parseFieldsERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrame11parseFieldsERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrame11parseFieldsERKNS_10ByteVectorE.stub =
        !0;
      function __ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrameD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrameD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v23Tag10setCommentERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v23Tag10setCommentERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v23Tag10setCommentERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v23Tag13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib5ID3v23Tag13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v23Tag13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib5ID3v23Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE() {
        return wasmImports._ZN6TagLib5ID3v23Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v23Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE.stub =
        !0;
      function __ZN6TagLib5ID3v23Tag27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib5ID3v23Tag27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v23Tag27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib5ID3v23Tag7setYearEj() {
        return wasmImports._ZN6TagLib5ID3v23Tag7setYearEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v23Tag7setYearEj.stub = !0;
      function __ZN6TagLib5ID3v23Tag8setAlbumERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v23Tag8setAlbumERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v23Tag8setAlbumERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v23Tag8setGenreERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v23Tag8setGenreERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v23Tag8setGenreERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v23Tag8setTitleERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v23Tag8setTitleERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v23Tag8setTitleERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v23Tag8setTrackEj() {
        return wasmImports._ZN6TagLib5ID3v23Tag8setTrackEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v23Tag8setTrackEj.stub = !0;
      function __ZN6TagLib5ID3v23Tag9setArtistERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v23Tag9setArtistERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v23Tag9setArtistERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v23TagD0Ev() {
        return wasmImports._ZN6TagLib5ID3v23TagD0Ev.apply(null, arguments);
      }
      __ZN6TagLib5ID3v23TagD0Ev.stub = !0;
      function __ZN6TagLib5ID3v23TagD1Ev() {
        return wasmImports._ZN6TagLib5ID3v23TagD1Ev.apply(null, arguments);
      }
      __ZN6TagLib5ID3v23TagD1Ev.stub = !0;
      function __ZN6TagLib5ID3v25Frame12lyricsPrefixE() {
        return wasmImports._ZN6TagLib5ID3v25Frame12lyricsPrefixE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v25Frame12lyricsPrefixE.stub = !0;
      function __ZN6TagLib5ID3v25Frame13commentPrefixE() {
        return wasmImports._ZN6TagLib5ID3v25Frame13commentPrefixE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v25Frame13commentPrefixE.stub = !0;
      function __ZN6TagLib5ID3v25Frame16instrumentPrefixE() {
        return wasmImports._ZN6TagLib5ID3v25Frame16instrumentPrefixE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v25Frame16instrumentPrefixE.stub = !0;
      function __ZN6TagLib5ID3v25Frame6HeaderD0Ev() {
        return wasmImports._ZN6TagLib5ID3v25Frame6HeaderD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v25Frame6HeaderD0Ev.stub = !0;
      function __ZN6TagLib5ID3v25Frame6HeaderD1Ev() {
        return wasmImports._ZN6TagLib5ID3v25Frame6HeaderD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v25Frame6HeaderD1Ev.stub = !0;
      function __ZN6TagLib5ID3v25Frame7setTextERKNS_6StringE() {
        return wasmImports._ZN6TagLib5ID3v25Frame7setTextERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v25Frame7setTextERKNS_6StringE.stub = !0;
      function __ZN6TagLib5ID3v25Frame9urlPrefixE() {
        return wasmImports._ZN6TagLib5ID3v25Frame9urlPrefixE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib5ID3v25Frame9urlPrefixE.stub = !0;
      function __ZN6TagLib5ID3v25FrameD0Ev() {
        return wasmImports._ZN6TagLib5ID3v25FrameD0Ev.apply(null, arguments);
      }
      __ZN6TagLib5ID3v25FrameD0Ev.stub = !0;
      function __ZN6TagLib5ID3v25FrameD1Ev() {
        return wasmImports._ZN6TagLib5ID3v25FrameD1Ev.apply(null, arguments);
      }
      __ZN6TagLib5ID3v25FrameD1Ev.stub = !0;
      function __ZN6TagLib5ID3v26FooterD0Ev() {
        return wasmImports._ZN6TagLib5ID3v26FooterD0Ev.apply(null, arguments);
      }
      __ZN6TagLib5ID3v26FooterD0Ev.stub = !0;
      function __ZN6TagLib5ID3v26FooterD1Ev() {
        return wasmImports._ZN6TagLib5ID3v26FooterD1Ev.apply(null, arguments);
      }
      __ZN6TagLib5ID3v26FooterD1Ev.stub = !0;
      function __ZN6TagLib5ID3v26HeaderD0Ev() {
        return wasmImports._ZN6TagLib5ID3v26HeaderD0Ev.apply(null, arguments);
      }
      __ZN6TagLib5ID3v26HeaderD0Ev.stub = !0;
      function __ZN6TagLib5ID3v26HeaderD1Ev() {
        return wasmImports._ZN6TagLib5ID3v26HeaderD1Ev.apply(null, arguments);
      }
      __ZN6TagLib5ID3v26HeaderD1Ev.stub = !0;
      function __ZN6TagLib6DSDIFF10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib6DSDIFF10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib6DSDIFF10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib6DSDIFF10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib6DSDIFF4DIIN3Tag10setCommentERKNS_6StringE() {
        return wasmImports._ZN6TagLib6DSDIFF4DIIN3Tag10setCommentERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4DIIN3Tag10setCommentERKNS_6StringE.stub = !0;
      function __ZN6TagLib6DSDIFF4DIIN3Tag13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib6DSDIFF4DIIN3Tag13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4DIIN3Tag13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib6DSDIFF4DIIN3Tag7setYearEj() {
        return wasmImports._ZN6TagLib6DSDIFF4DIIN3Tag7setYearEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4DIIN3Tag7setYearEj.stub = !0;
      function __ZN6TagLib6DSDIFF4DIIN3Tag8setAlbumERKNS_6StringE() {
        return wasmImports._ZN6TagLib6DSDIFF4DIIN3Tag8setAlbumERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4DIIN3Tag8setAlbumERKNS_6StringE.stub = !0;
      function __ZN6TagLib6DSDIFF4DIIN3Tag8setGenreERKNS_6StringE() {
        return wasmImports._ZN6TagLib6DSDIFF4DIIN3Tag8setGenreERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4DIIN3Tag8setGenreERKNS_6StringE.stub = !0;
      function __ZN6TagLib6DSDIFF4DIIN3Tag8setTitleERKNS_6StringE() {
        return wasmImports._ZN6TagLib6DSDIFF4DIIN3Tag8setTitleERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4DIIN3Tag8setTitleERKNS_6StringE.stub = !0;
      function __ZN6TagLib6DSDIFF4DIIN3Tag8setTrackEj() {
        return wasmImports._ZN6TagLib6DSDIFF4DIIN3Tag8setTrackEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4DIIN3Tag8setTrackEj.stub = !0;
      function __ZN6TagLib6DSDIFF4DIIN3Tag9setArtistERKNS_6StringE() {
        return wasmImports._ZN6TagLib6DSDIFF4DIIN3Tag9setArtistERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4DIIN3Tag9setArtistERKNS_6StringE.stub = !0;
      function __ZN6TagLib6DSDIFF4DIIN3TagD0Ev() {
        return wasmImports._ZN6TagLib6DSDIFF4DIIN3TagD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4DIIN3TagD0Ev.stub = !0;
      function __ZN6TagLib6DSDIFF4DIIN3TagD1Ev() {
        return wasmImports._ZN6TagLib6DSDIFF4DIIN3TagD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4DIIN3TagD1Ev.stub = !0;
      function __ZN6TagLib6DSDIFF4File11FilePrivateD2Ev() {
        return wasmImports._ZN6TagLib6DSDIFF4File11FilePrivateD2Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4File11FilePrivateD2Ev.stub = !0;
      function __ZN6TagLib6DSDIFF4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib6DSDIFF4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib6DSDIFF4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib6DSDIFF4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib6DSDIFF4File4saveEv() {
        return wasmImports._ZN6TagLib6DSDIFF4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib6DSDIFF4File4saveEv.stub = !0;
      function __ZN6TagLib6DSDIFF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE() {
        return wasmImports._ZN6TagLib6DSDIFF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6DSDIFF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.stub =
        !0;
      function __ZN6TagLib6DSDIFF4FileD0Ev() {
        return wasmImports._ZN6TagLib6DSDIFF4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib6DSDIFF4FileD0Ev.stub = !0;
      function __ZN6TagLib6DSDIFF4FileD1Ev() {
        return wasmImports._ZN6TagLib6DSDIFF4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib6DSDIFF4FileD1Ev.stub = !0;
      function __ZN6TagLib6StringC1EPKcNS0_4TypeE() {
        return wasmImports._ZN6TagLib6StringC1EPKcNS0_4TypeE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6StringC1EPKcNS0_4TypeE.stub = !0;
      function __ZN6TagLib6StringC1ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS0_4TypeE() {
        return wasmImports._ZN6TagLib6StringC1ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS0_4TypeE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6StringC1ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS0_4TypeE.stub =
        !0;
      function __ZN6TagLib6StringC1ERKS0_() {
        return wasmImports._ZN6TagLib6StringC1ERKS0_.apply(null, arguments);
      }
      __ZN6TagLib6StringC1ERKS0_.stub = !0;
      function __ZN6TagLib6StringD1Ev() {
        return wasmImports._ZN6TagLib6StringD1Ev.apply(null, arguments);
      }
      __ZN6TagLib6StringD1Ev.stub = !0;
      function __ZN6TagLib6Vorbis10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib6Vorbis10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6Vorbis10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib6Vorbis10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib6Vorbis10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6Vorbis10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib6Vorbis4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib6Vorbis4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6Vorbis4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib6Vorbis4File4saveEv() {
        return wasmImports._ZN6TagLib6Vorbis4File4saveEv.apply(null, arguments);
      }
      __ZN6TagLib6Vorbis4File4saveEv.stub = !0;
      function __ZN6TagLib6Vorbis4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib6Vorbis4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib6Vorbis4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib6Vorbis4FileD0Ev() {
        return wasmImports._ZN6TagLib6Vorbis4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib6Vorbis4FileD0Ev.stub = !0;
      function __ZN6TagLib6Vorbis4FileD1Ev() {
        return wasmImports._ZN6TagLib6Vorbis4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib6Vorbis4FileD1Ev.stub = !0;
      function __ZN6TagLib7FileRef13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib7FileRef13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7FileRef13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib7FileRef20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE() {
        return wasmImports._ZN6TagLib7FileRef20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7FileRef20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE.stub =
        !0;
      function __ZN6TagLib7FileRef4saveEv() {
        return wasmImports._ZN6TagLib7FileRef4saveEv.apply(null, arguments);
      }
      __ZN6TagLib7FileRef4saveEv.stub = !0;
      function __ZN6TagLib7FileRefC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib7FileRefC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7FileRefC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib7FileRefC1EPNS_4FileE() {
        return wasmImports._ZN6TagLib7FileRefC1EPNS_4FileE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7FileRefC1EPNS_4FileE.stub = !0;
      function __ZN6TagLib7FileRefC1EPNS_8IOStreamEbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib7FileRefC1EPNS_8IOStreamEbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7FileRefC1EPNS_8IOStreamEbNS_15AudioProperties9ReadStyleE.stub =
        !0;
      function __ZN6TagLib7FileRefD1Ev() {
        return wasmImports._ZN6TagLib7FileRefD1Ev.apply(null, arguments);
      }
      __ZN6TagLib7FileRefD1Ev.stub = !0;
      function __ZN6TagLib7VariantC1EPKc() {
        return wasmImports._ZN6TagLib7VariantC1EPKc.apply(null, arguments);
      }
      __ZN6TagLib7VariantC1EPKc.stub = !0;
      function __ZN6TagLib7VariantC1ERKNS_10ByteVectorE() {
        return wasmImports._ZN6TagLib7VariantC1ERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7VariantC1ERKNS_10ByteVectorE.stub = !0;
      function __ZN6TagLib7VariantC1ERKNS_10StringListE() {
        return wasmImports._ZN6TagLib7VariantC1ERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7VariantC1ERKNS_10StringListE.stub = !0;
      function __ZN6TagLib7VariantC1ERKS0_() {
        return wasmImports._ZN6TagLib7VariantC1ERKS0_.apply(null, arguments);
      }
      __ZN6TagLib7VariantC1ERKS0_.stub = !0;
      function __ZN6TagLib7VariantC1Eb() {
        return wasmImports._ZN6TagLib7VariantC1Eb.apply(null, arguments);
      }
      __ZN6TagLib7VariantC1Eb.stub = !0;
      function __ZN6TagLib7VariantC1Ed() {
        return wasmImports._ZN6TagLib7VariantC1Ed.apply(null, arguments);
      }
      __ZN6TagLib7VariantC1Ed.stub = !0;
      function __ZN6TagLib7VariantC1Ei() {
        return wasmImports._ZN6TagLib7VariantC1Ei.apply(null, arguments);
      }
      __ZN6TagLib7VariantC1Ei.stub = !0;
      function __ZN6TagLib7VariantC1Ej() {
        return wasmImports._ZN6TagLib7VariantC1Ej.apply(null, arguments);
      }
      __ZN6TagLib7VariantC1Ej.stub = !0;
      function __ZN6TagLib7VariantC1Ev() {
        return wasmImports._ZN6TagLib7VariantC1Ev.apply(null, arguments);
      }
      __ZN6TagLib7VariantC1Ev.stub = !0;
      function __ZN6TagLib7VariantC1Ex() {
        return wasmImports._ZN6TagLib7VariantC1Ex.apply(null, arguments);
      }
      __ZN6TagLib7VariantC1Ex.stub = !0;
      function __ZN6TagLib7VariantC1Ey() {
        return wasmImports._ZN6TagLib7VariantC1Ey.apply(null, arguments);
      }
      __ZN6TagLib7VariantC1Ey.stub = !0;
      function __ZN6TagLib7VariantD1Ev() {
        return wasmImports._ZN6TagLib7VariantD1Ev.apply(null, arguments);
      }
      __ZN6TagLib7VariantD1Ev.stub = !0;
      function __ZN6TagLib7VariantaSERKS0_() {
        return wasmImports._ZN6TagLib7VariantaSERKS0_.apply(null, arguments);
      }
      __ZN6TagLib7VariantaSERKS0_.stub = !0;
      function __ZN6TagLib7WavPack10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib7WavPack10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7WavPack10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib7WavPack10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib7WavPack10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7WavPack10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib7WavPack4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib7WavPack4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7WavPack4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib7WavPack4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib7WavPack4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7WavPack4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib7WavPack4File4saveEv() {
        return wasmImports._ZN6TagLib7WavPack4File4saveEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7WavPack4File4saveEv.stub = !0;
      function __ZN6TagLib7WavPack4FileC1EPKcbNS_15AudioProperties9ReadStyleE() {
        return wasmImports._ZN6TagLib7WavPack4FileC1EPKcbNS_15AudioProperties9ReadStyleE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib7WavPack4FileC1EPKcbNS_15AudioProperties9ReadStyleE.stub = !0;
      function __ZN6TagLib7WavPack4FileD0Ev() {
        return wasmImports._ZN6TagLib7WavPack4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib7WavPack4FileD0Ev.stub = !0;
      function __ZN6TagLib7WavPack4FileD1Ev() {
        return wasmImports._ZN6TagLib7WavPack4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib7WavPack4FileD1Ev.stub = !0;
      function __ZN6TagLib8IOStream5clearEv() {
        return wasmImports._ZN6TagLib8IOStream5clearEv.apply(null, arguments);
      }
      __ZN6TagLib8IOStream5clearEv.stub = !0;
      function __ZN6TagLib8IOStreamD0Ev() {
        return wasmImports._ZN6TagLib8IOStreamD0Ev.apply(null, arguments);
      }
      __ZN6TagLib8IOStreamD0Ev.stub = !0;
      function __ZN6TagLib8IOStreamD1Ev() {
        return wasmImports._ZN6TagLib8IOStreamD1Ev.apply(null, arguments);
      }
      __ZN6TagLib8IOStreamD1Ev.stub = !0;
      function __ZN6TagLib8TagUnion10setCommentERKNS_6StringE() {
        return wasmImports._ZN6TagLib8TagUnion10setCommentERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib8TagUnion10setCommentERKNS_6StringE.stub = !0;
      function __ZN6TagLib8TagUnion20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE() {
        return wasmImports._ZN6TagLib8TagUnion20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib8TagUnion20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE.stub =
        !0;
      function __ZN6TagLib8TagUnion27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib8TagUnion27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib8TagUnion27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib8TagUnion7setYearEj() {
        return wasmImports._ZN6TagLib8TagUnion7setYearEj.apply(null, arguments);
      }
      __ZN6TagLib8TagUnion7setYearEj.stub = !0;
      function __ZN6TagLib8TagUnion8setAlbumERKNS_6StringE() {
        return wasmImports._ZN6TagLib8TagUnion8setAlbumERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib8TagUnion8setAlbumERKNS_6StringE.stub = !0;
      function __ZN6TagLib8TagUnion8setGenreERKNS_6StringE() {
        return wasmImports._ZN6TagLib8TagUnion8setGenreERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib8TagUnion8setGenreERKNS_6StringE.stub = !0;
      function __ZN6TagLib8TagUnion8setTitleERKNS_6StringE() {
        return wasmImports._ZN6TagLib8TagUnion8setTitleERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib8TagUnion8setTitleERKNS_6StringE.stub = !0;
      function __ZN6TagLib8TagUnion8setTrackEj() {
        return wasmImports._ZN6TagLib8TagUnion8setTrackEj.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib8TagUnion8setTrackEj.stub = !0;
      function __ZN6TagLib8TagUnion9setArtistERKNS_6StringE() {
        return wasmImports._ZN6TagLib8TagUnion9setArtistERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib8TagUnion9setArtistERKNS_6StringE.stub = !0;
      function __ZN6TagLib8TagUnionD0Ev() {
        return wasmImports._ZN6TagLib8TagUnionD0Ev.apply(null, arguments);
      }
      __ZN6TagLib8TagUnionD0Ev.stub = !0;
      function __ZN6TagLib8TagUnionD1Ev() {
        return wasmImports._ZN6TagLib8TagUnionD1Ev.apply(null, arguments);
      }
      __ZN6TagLib8TagUnionD1Ev.stub = !0;
      function __ZN6TagLib9TrueAudio10PropertiesD0Ev() {
        return wasmImports._ZN6TagLib9TrueAudio10PropertiesD0Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib9TrueAudio10PropertiesD0Ev.stub = !0;
      function __ZN6TagLib9TrueAudio10PropertiesD1Ev() {
        return wasmImports._ZN6TagLib9TrueAudio10PropertiesD1Ev.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib9TrueAudio10PropertiesD1Ev.stub = !0;
      function __ZN6TagLib9TrueAudio4File13setPropertiesERKNS_11PropertyMapE() {
        return wasmImports._ZN6TagLib9TrueAudio4File13setPropertiesERKNS_11PropertyMapE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib9TrueAudio4File13setPropertiesERKNS_11PropertyMapE.stub = !0;
      function __ZN6TagLib9TrueAudio4File27removeUnsupportedPropertiesERKNS_10StringListE() {
        return wasmImports._ZN6TagLib9TrueAudio4File27removeUnsupportedPropertiesERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib9TrueAudio4File27removeUnsupportedPropertiesERKNS_10StringListE.stub =
        !0;
      function __ZN6TagLib9TrueAudio4File4saveEv() {
        return wasmImports._ZN6TagLib9TrueAudio4File4saveEv.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib9TrueAudio4File4saveEv.stub = !0;
      function __ZN6TagLib9TrueAudio4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE() {
        return wasmImports._ZN6TagLib9TrueAudio4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.apply(
          null,
          arguments
        );
      }
      __ZN6TagLib9TrueAudio4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE.stub =
        !0;
      function __ZN6TagLib9TrueAudio4FileD0Ev() {
        return wasmImports._ZN6TagLib9TrueAudio4FileD0Ev.apply(null, arguments);
      }
      __ZN6TagLib9TrueAudio4FileD0Ev.stub = !0;
      function __ZN6TagLib9TrueAudio4FileD1Ev() {
        return wasmImports._ZN6TagLib9TrueAudio4FileD1Ev.apply(null, arguments);
      }
      __ZN6TagLib9TrueAudio4FileD1Ev.stub = !0;
      function __ZNK4utf812invalid_utf84whatEv() {
        return wasmImports._ZNK4utf812invalid_utf84whatEv.apply(
          null,
          arguments
        );
      }
      __ZNK4utf812invalid_utf84whatEv.stub = !0;
      function __ZNK4utf813invalid_utf164whatEv() {
        return wasmImports._ZNK4utf813invalid_utf164whatEv.apply(
          null,
          arguments
        );
      }
      __ZNK4utf813invalid_utf164whatEv.stub = !0;
      function __ZNK4utf815not_enough_room4whatEv() {
        return wasmImports._ZNK4utf815not_enough_room4whatEv.apply(
          null,
          arguments
        );
      }
      __ZNK4utf815not_enough_room4whatEv.stub = !0;
      function __ZNK4utf818invalid_code_point4whatEv() {
        return wasmImports._ZNK4utf818invalid_code_point4whatEv.apply(
          null,
          arguments
        );
      }
      __ZNK4utf818invalid_code_point4whatEv.stub = !0;
      function __ZNK6TagLib10ByteVector4dataEv() {
        return wasmImports._ZNK6TagLib10ByteVector4dataEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib10ByteVector4dataEv.stub = !0;
      function __ZNK6TagLib10ByteVector4sizeEv() {
        return wasmImports._ZNK6TagLib10ByteVector4sizeEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib10ByteVector4sizeEv.stub = !0;
      function __ZNK6TagLib10FileStream4nameEv() {
        return wasmImports._ZNK6TagLib10FileStream4nameEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib10FileStream4nameEv.stub = !0;
      function __ZNK6TagLib10FileStream4tellEv() {
        return wasmImports._ZNK6TagLib10FileStream4tellEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib10FileStream4tellEv.stub = !0;
      function __ZNK6TagLib10FileStream6isOpenEv() {
        return wasmImports._ZNK6TagLib10FileStream6isOpenEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib10FileStream6isOpenEv.stub = !0;
      function __ZNK6TagLib10FileStream8readOnlyEv() {
        return wasmImports._ZNK6TagLib10FileStream8readOnlyEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib10FileStream8readOnlyEv.stub = !0;
      function __ZNK6TagLib11PropertyMap4findERKNS_6StringE() {
        return wasmImports._ZNK6TagLib11PropertyMap4findERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib11PropertyMap4findERKNS_6StringE.stub = !0;
      function __ZNK6TagLib15AudioProperties10sampleRateEv() {
        return wasmImports._ZNK6TagLib15AudioProperties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib15AudioProperties10sampleRateEv.stub = !0;
      function __ZNK6TagLib15AudioProperties15lengthInSecondsEv() {
        return wasmImports._ZNK6TagLib15AudioProperties15lengthInSecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib15AudioProperties15lengthInSecondsEv.stub = !0;
      function __ZNK6TagLib15AudioProperties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib15AudioProperties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib15AudioProperties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib15AudioProperties6lengthEv() {
        return wasmImports._ZNK6TagLib15AudioProperties6lengthEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib15AudioProperties6lengthEv.stub = !0;
      function __ZNK6TagLib15AudioProperties7bitrateEv() {
        return wasmImports._ZNK6TagLib15AudioProperties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib15AudioProperties7bitrateEv.stub = !0;
      function __ZNK6TagLib16ByteVectorStream4nameEv() {
        return wasmImports._ZNK6TagLib16ByteVectorStream4nameEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib16ByteVectorStream4nameEv.stub = !0;
      function __ZNK6TagLib16ByteVectorStream4tellEv() {
        return wasmImports._ZNK6TagLib16ByteVectorStream4tellEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib16ByteVectorStream4tellEv.stub = !0;
      function __ZNK6TagLib16ByteVectorStream6isOpenEv() {
        return wasmImports._ZNK6TagLib16ByteVectorStream6isOpenEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib16ByteVectorStream6isOpenEv.stub = !0;
      function __ZNK6TagLib16ByteVectorStream8readOnlyEv() {
        return wasmImports._ZNK6TagLib16ByteVectorStream8readOnlyEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib16ByteVectorStream8readOnlyEv.stub = !0;
      function __ZNK6TagLib2IT10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib2IT10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib2IT10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib2IT4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib2IT4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib2IT4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib2IT4File3tagEv() {
        return wasmImports._ZNK6TagLib2IT4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib2IT4File3tagEv.stub = !0;
      function __ZNK6TagLib2XM10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib2XM10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib2XM10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib2XM4File10propertiesEv() {
        return wasmImports._ZNK6TagLib2XM4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib2XM4File10propertiesEv.stub = !0;
      function __ZNK6TagLib2XM4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib2XM4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib2XM4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib2XM4File3tagEv() {
        return wasmImports._ZNK6TagLib2XM4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib2XM4File3tagEv.stub = !0;
      function __ZNK6TagLib3APE10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib3APE10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3APE10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib3APE10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib3APE10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3APE10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib3APE10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib3APE10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3APE10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib3APE10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib3APE10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3APE10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib3APE3Tag10propertiesEv() {
        return wasmImports._ZNK6TagLib3APE3Tag10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3APE3Tag10propertiesEv.stub = !0;
      function __ZNK6TagLib3APE3Tag17complexPropertiesERKNS_6StringE() {
        return wasmImports._ZNK6TagLib3APE3Tag17complexPropertiesERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3APE3Tag17complexPropertiesERKNS_6StringE.stub = !0;
      function __ZNK6TagLib3APE3Tag19complexPropertyKeysEv() {
        return wasmImports._ZNK6TagLib3APE3Tag19complexPropertyKeysEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3APE3Tag19complexPropertyKeysEv.stub = !0;
      function __ZNK6TagLib3APE3Tag4yearEv() {
        return wasmImports._ZNK6TagLib3APE3Tag4yearEv.apply(null, arguments);
      }
      __ZNK6TagLib3APE3Tag4yearEv.stub = !0;
      function __ZNK6TagLib3APE3Tag5albumEv() {
        return wasmImports._ZNK6TagLib3APE3Tag5albumEv.apply(null, arguments);
      }
      __ZNK6TagLib3APE3Tag5albumEv.stub = !0;
      function __ZNK6TagLib3APE3Tag5genreEv() {
        return wasmImports._ZNK6TagLib3APE3Tag5genreEv.apply(null, arguments);
      }
      __ZNK6TagLib3APE3Tag5genreEv.stub = !0;
      function __ZNK6TagLib3APE3Tag5titleEv() {
        return wasmImports._ZNK6TagLib3APE3Tag5titleEv.apply(null, arguments);
      }
      __ZNK6TagLib3APE3Tag5titleEv.stub = !0;
      function __ZNK6TagLib3APE3Tag5trackEv() {
        return wasmImports._ZNK6TagLib3APE3Tag5trackEv.apply(null, arguments);
      }
      __ZNK6TagLib3APE3Tag5trackEv.stub = !0;
      function __ZNK6TagLib3APE3Tag6artistEv() {
        return wasmImports._ZNK6TagLib3APE3Tag6artistEv.apply(null, arguments);
      }
      __ZNK6TagLib3APE3Tag6artistEv.stub = !0;
      function __ZNK6TagLib3APE3Tag7commentEv() {
        return wasmImports._ZNK6TagLib3APE3Tag7commentEv.apply(null, arguments);
      }
      __ZNK6TagLib3APE3Tag7commentEv.stub = !0;
      function __ZNK6TagLib3APE3Tag7isEmptyEv() {
        return wasmImports._ZNK6TagLib3APE3Tag7isEmptyEv.apply(null, arguments);
      }
      __ZNK6TagLib3APE3Tag7isEmptyEv.stub = !0;
      function __ZNK6TagLib3APE4File10propertiesEv() {
        return wasmImports._ZNK6TagLib3APE4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3APE4File10propertiesEv.stub = !0;
      function __ZNK6TagLib3APE4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib3APE4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3APE4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib3APE4File3tagEv() {
        return wasmImports._ZNK6TagLib3APE4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib3APE4File3tagEv.stub = !0;
      function __ZNK6TagLib3ASF10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib3ASF10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib3ASF10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib3ASF10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib3ASF10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib3ASF10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib3ASF10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib3ASF10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag10propertiesEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF3Tag10propertiesEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag17complexPropertiesERKNS_6StringE() {
        return wasmImports._ZNK6TagLib3ASF3Tag17complexPropertiesERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF3Tag17complexPropertiesERKNS_6StringE.stub = !0;
      function __ZNK6TagLib3ASF3Tag19complexPropertyKeysEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag19complexPropertyKeysEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF3Tag19complexPropertyKeysEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag4yearEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag4yearEv.apply(null, arguments);
      }
      __ZNK6TagLib3ASF3Tag4yearEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag5albumEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag5albumEv.apply(null, arguments);
      }
      __ZNK6TagLib3ASF3Tag5albumEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag5genreEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag5genreEv.apply(null, arguments);
      }
      __ZNK6TagLib3ASF3Tag5genreEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag5titleEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag5titleEv.apply(null, arguments);
      }
      __ZNK6TagLib3ASF3Tag5titleEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag5trackEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag5trackEv.apply(null, arguments);
      }
      __ZNK6TagLib3ASF3Tag5trackEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag6artistEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag6artistEv.apply(null, arguments);
      }
      __ZNK6TagLib3ASF3Tag6artistEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag6ratingEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag6ratingEv.apply(null, arguments);
      }
      __ZNK6TagLib3ASF3Tag6ratingEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag7commentEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag7commentEv.apply(null, arguments);
      }
      __ZNK6TagLib3ASF3Tag7commentEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag7isEmptyEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag7isEmptyEv.apply(null, arguments);
      }
      __ZNK6TagLib3ASF3Tag7isEmptyEv.stub = !0;
      function __ZNK6TagLib3ASF3Tag9copyrightEv() {
        return wasmImports._ZNK6TagLib3ASF3Tag9copyrightEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF3Tag9copyrightEv.stub = !0;
      function __ZNK6TagLib3ASF4File10propertiesEv() {
        return wasmImports._ZNK6TagLib3ASF4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File10propertiesEv.stub = !0;
      function __ZNK6TagLib3ASF4File11FilePrivate13UnknownObject4guidEv() {
        return wasmImports._ZNK6TagLib3ASF4File11FilePrivate13UnknownObject4guidEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File11FilePrivate13UnknownObject4guidEv.stub = !0;
      function __ZNK6TagLib3ASF4File11FilePrivate14MetadataObject4guidEv() {
        return wasmImports._ZNK6TagLib3ASF4File11FilePrivate14MetadataObject4guidEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File11FilePrivate14MetadataObject4guidEv.stub = !0;
      function __ZNK6TagLib3ASF4File11FilePrivate15CodecListObject4guidEv() {
        return wasmImports._ZNK6TagLib3ASF4File11FilePrivate15CodecListObject4guidEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File11FilePrivate15CodecListObject4guidEv.stub = !0;
      function __ZNK6TagLib3ASF4File11FilePrivate20FilePropertiesObject4guidEv() {
        return wasmImports._ZNK6TagLib3ASF4File11FilePrivate20FilePropertiesObject4guidEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File11FilePrivate20FilePropertiesObject4guidEv.stub = !0;
      function __ZNK6TagLib3ASF4File11FilePrivate21HeaderExtensionObject4guidEv() {
        return wasmImports._ZNK6TagLib3ASF4File11FilePrivate21HeaderExtensionObject4guidEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File11FilePrivate21HeaderExtensionObject4guidEv.stub =
        !0;
      function __ZNK6TagLib3ASF4File11FilePrivate21MetadataLibraryObject4guidEv() {
        return wasmImports._ZNK6TagLib3ASF4File11FilePrivate21MetadataLibraryObject4guidEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File11FilePrivate21MetadataLibraryObject4guidEv.stub =
        !0;
      function __ZNK6TagLib3ASF4File11FilePrivate22StreamPropertiesObject4guidEv() {
        return wasmImports._ZNK6TagLib3ASF4File11FilePrivate22StreamPropertiesObject4guidEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File11FilePrivate22StreamPropertiesObject4guidEv.stub =
        !0;
      function __ZNK6TagLib3ASF4File11FilePrivate24ContentDescriptionObject4guidEv() {
        return wasmImports._ZNK6TagLib3ASF4File11FilePrivate24ContentDescriptionObject4guidEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File11FilePrivate24ContentDescriptionObject4guidEv.stub =
        !0;
      function __ZNK6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject4guidEv() {
        return wasmImports._ZNK6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject4guidEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject4guidEv.stub =
        !0;
      function __ZNK6TagLib3ASF4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib3ASF4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3ASF4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib3ASF4File3tagEv() {
        return wasmImports._ZNK6TagLib3ASF4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib3ASF4File3tagEv.stub = !0;
      function __ZNK6TagLib3DSF10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib3DSF10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3DSF10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib3DSF10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib3DSF10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3DSF10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib3DSF10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib3DSF10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3DSF10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib3DSF10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib3DSF10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3DSF10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib3DSF4File10propertiesEv() {
        return wasmImports._ZNK6TagLib3DSF4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3DSF4File10propertiesEv.stub = !0;
      function __ZNK6TagLib3DSF4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib3DSF4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3DSF4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib3DSF4File3tagEv() {
        return wasmImports._ZNK6TagLib3DSF4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib3DSF4File3tagEv.stub = !0;
      function __ZNK6TagLib3MP410Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib3MP410Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP410Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib3MP410Properties13bitsPerSampleEv() {
        return wasmImports._ZNK6TagLib3MP410Properties13bitsPerSampleEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP410Properties13bitsPerSampleEv.stub = !0;
      function __ZNK6TagLib3MP410Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib3MP410Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP410Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib3MP410Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib3MP410Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP410Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib3MP410Properties8channelsEv() {
        return wasmImports._ZNK6TagLib3MP410Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP410Properties8channelsEv.stub = !0;
      function __ZNK6TagLib3MP411ItemFactory10renderItemERKNS_6StringERKNS0_4ItemE() {
        return wasmImports._ZNK6TagLib3MP411ItemFactory10renderItemERKNS_6StringERKNS0_4ItemE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP411ItemFactory10renderItemERKNS_6StringERKNS0_4ItemE.stub =
        !0;
      function __ZNK6TagLib3MP411ItemFactory14itemToPropertyERKNS_10ByteVectorERKNS0_4ItemE() {
        return wasmImports._ZNK6TagLib3MP411ItemFactory14itemToPropertyERKNS_10ByteVectorERKNS0_4ItemE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP411ItemFactory14itemToPropertyERKNS_10ByteVectorERKNS0_4ItemE.stub =
        !0;
      function __ZNK6TagLib3MP411ItemFactory14nameHandlerMapEv() {
        return wasmImports._ZNK6TagLib3MP411ItemFactory14nameHandlerMapEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP411ItemFactory14nameHandlerMapEv.stub = !0;
      function __ZNK6TagLib3MP411ItemFactory15namePropertyMapEv() {
        return wasmImports._ZNK6TagLib3MP411ItemFactory15namePropertyMapEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP411ItemFactory15namePropertyMapEv.stub = !0;
      function __ZNK6TagLib3MP411ItemFactory16itemFromPropertyERKNS_6StringERKNS_10StringListE() {
        return wasmImports._ZNK6TagLib3MP411ItemFactory16itemFromPropertyERKNS_6StringERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP411ItemFactory16itemFromPropertyERKNS_6StringERKNS_10StringListE.stub =
        !0;
      function __ZNK6TagLib3MP411ItemFactory18handlerTypeForNameERKNS_10ByteVectorE() {
        return wasmImports._ZNK6TagLib3MP411ItemFactory18handlerTypeForNameERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP411ItemFactory18handlerTypeForNameERKNS_10ByteVectorE.stub =
        !0;
      function __ZNK6TagLib3MP411ItemFactory18nameForPropertyKeyERKNS_6StringE() {
        return wasmImports._ZNK6TagLib3MP411ItemFactory18nameForPropertyKeyERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP411ItemFactory18nameForPropertyKeyERKNS_6StringE.stub = !0;
      function __ZNK6TagLib3MP411ItemFactory18propertyKeyForNameERKNS_10ByteVectorE() {
        return wasmImports._ZNK6TagLib3MP411ItemFactory18propertyKeyForNameERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP411ItemFactory18propertyKeyForNameERKNS_10ByteVectorE.stub =
        !0;
      function __ZNK6TagLib3MP411ItemFactory9parseItemEPKNS0_4AtomERKNS_10ByteVectorE() {
        return wasmImports._ZNK6TagLib3MP411ItemFactory9parseItemEPKNS0_4AtomERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP411ItemFactory9parseItemEPKNS0_4AtomERKNS_10ByteVectorE.stub =
        !0;
      function __ZNK6TagLib3MP43Tag10propertiesEv() {
        return wasmImports._ZNK6TagLib3MP43Tag10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP43Tag10propertiesEv.stub = !0;
      function __ZNK6TagLib3MP43Tag17complexPropertiesERKNS_6StringE() {
        return wasmImports._ZNK6TagLib3MP43Tag17complexPropertiesERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP43Tag17complexPropertiesERKNS_6StringE.stub = !0;
      function __ZNK6TagLib3MP43Tag19complexPropertyKeysEv() {
        return wasmImports._ZNK6TagLib3MP43Tag19complexPropertyKeysEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP43Tag19complexPropertyKeysEv.stub = !0;
      function __ZNK6TagLib3MP43Tag4yearEv() {
        return wasmImports._ZNK6TagLib3MP43Tag4yearEv.apply(null, arguments);
      }
      __ZNK6TagLib3MP43Tag4yearEv.stub = !0;
      function __ZNK6TagLib3MP43Tag5albumEv() {
        return wasmImports._ZNK6TagLib3MP43Tag5albumEv.apply(null, arguments);
      }
      __ZNK6TagLib3MP43Tag5albumEv.stub = !0;
      function __ZNK6TagLib3MP43Tag5genreEv() {
        return wasmImports._ZNK6TagLib3MP43Tag5genreEv.apply(null, arguments);
      }
      __ZNK6TagLib3MP43Tag5genreEv.stub = !0;
      function __ZNK6TagLib3MP43Tag5titleEv() {
        return wasmImports._ZNK6TagLib3MP43Tag5titleEv.apply(null, arguments);
      }
      __ZNK6TagLib3MP43Tag5titleEv.stub = !0;
      function __ZNK6TagLib3MP43Tag5trackEv() {
        return wasmImports._ZNK6TagLib3MP43Tag5trackEv.apply(null, arguments);
      }
      __ZNK6TagLib3MP43Tag5trackEv.stub = !0;
      function __ZNK6TagLib3MP43Tag6artistEv() {
        return wasmImports._ZNK6TagLib3MP43Tag6artistEv.apply(null, arguments);
      }
      __ZNK6TagLib3MP43Tag6artistEv.stub = !0;
      function __ZNK6TagLib3MP43Tag7commentEv() {
        return wasmImports._ZNK6TagLib3MP43Tag7commentEv.apply(null, arguments);
      }
      __ZNK6TagLib3MP43Tag7commentEv.stub = !0;
      function __ZNK6TagLib3MP43Tag7isEmptyEv() {
        return wasmImports._ZNK6TagLib3MP43Tag7isEmptyEv.apply(null, arguments);
      }
      __ZNK6TagLib3MP43Tag7isEmptyEv.stub = !0;
      function __ZNK6TagLib3MP44File10propertiesEv() {
        return wasmImports._ZNK6TagLib3MP44File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP44File10propertiesEv.stub = !0;
      function __ZNK6TagLib3MP44File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib3MP44File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MP44File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib3MP44File3tagEv() {
        return wasmImports._ZNK6TagLib3MP44File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib3MP44File3tagEv.stub = !0;
      function __ZNK6TagLib3MPC10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib3MPC10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MPC10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib3MPC10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib3MPC10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MPC10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib3MPC10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib3MPC10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MPC10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib3MPC10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib3MPC10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MPC10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib3MPC4File10propertiesEv() {
        return wasmImports._ZNK6TagLib3MPC4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MPC4File10propertiesEv.stub = !0;
      function __ZNK6TagLib3MPC4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib3MPC4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MPC4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib3MPC4File3tagEv() {
        return wasmImports._ZNK6TagLib3MPC4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib3MPC4File3tagEv.stub = !0;
      function __ZNK6TagLib3MapINS_6StringENS_7VariantEEeqERKS3_() {
        return wasmImports._ZNK6TagLib3MapINS_6StringENS_7VariantEEeqERKS3_.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3MapINS_6StringENS_7VariantEEeqERKS3_.stub = !0;
      function __ZNK6TagLib3Mod10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib3Mod10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Mod10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib3Mod10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib3Mod10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Mod10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib3Mod10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib3Mod10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Mod10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib3Mod3Tag10propertiesEv() {
        return wasmImports._ZNK6TagLib3Mod3Tag10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Mod3Tag10propertiesEv.stub = !0;
      function __ZNK6TagLib3Mod3Tag4yearEv() {
        return wasmImports._ZNK6TagLib3Mod3Tag4yearEv.apply(null, arguments);
      }
      __ZNK6TagLib3Mod3Tag4yearEv.stub = !0;
      function __ZNK6TagLib3Mod3Tag5albumEv() {
        return wasmImports._ZNK6TagLib3Mod3Tag5albumEv.apply(null, arguments);
      }
      __ZNK6TagLib3Mod3Tag5albumEv.stub = !0;
      function __ZNK6TagLib3Mod3Tag5genreEv() {
        return wasmImports._ZNK6TagLib3Mod3Tag5genreEv.apply(null, arguments);
      }
      __ZNK6TagLib3Mod3Tag5genreEv.stub = !0;
      function __ZNK6TagLib3Mod3Tag5titleEv() {
        return wasmImports._ZNK6TagLib3Mod3Tag5titleEv.apply(null, arguments);
      }
      __ZNK6TagLib3Mod3Tag5titleEv.stub = !0;
      function __ZNK6TagLib3Mod3Tag5trackEv() {
        return wasmImports._ZNK6TagLib3Mod3Tag5trackEv.apply(null, arguments);
      }
      __ZNK6TagLib3Mod3Tag5trackEv.stub = !0;
      function __ZNK6TagLib3Mod3Tag6artistEv() {
        return wasmImports._ZNK6TagLib3Mod3Tag6artistEv.apply(null, arguments);
      }
      __ZNK6TagLib3Mod3Tag6artistEv.stub = !0;
      function __ZNK6TagLib3Mod3Tag7commentEv() {
        return wasmImports._ZNK6TagLib3Mod3Tag7commentEv.apply(null, arguments);
      }
      __ZNK6TagLib3Mod3Tag7commentEv.stub = !0;
      function __ZNK6TagLib3Mod4File10propertiesEv() {
        return wasmImports._ZNK6TagLib3Mod4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Mod4File10propertiesEv.stub = !0;
      function __ZNK6TagLib3Mod4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib3Mod4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Mod4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib3Mod4File3tagEv() {
        return wasmImports._ZNK6TagLib3Mod4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib3Mod4File3tagEv.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment10propertiesEv() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment10propertiesEv.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment17complexPropertiesERKNS_6StringE() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment17complexPropertiesERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment17complexPropertiesERKNS_6StringE.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment19complexPropertyKeysEv() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment19complexPropertyKeysEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment19complexPropertyKeysEv.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment4yearEv() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment4yearEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment4yearEv.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment5albumEv() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment5albumEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment5albumEv.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment5genreEv() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment5genreEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment5genreEv.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment5titleEv() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment5titleEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment5titleEv.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment5trackEv() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment5trackEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment5trackEv.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment6artistEv() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment6artistEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment6artistEv.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment7commentEv() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment7commentEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment7commentEv.stub = !0;
      function __ZNK6TagLib3Ogg11XiphComment7isEmptyEv() {
        return wasmImports._ZNK6TagLib3Ogg11XiphComment7isEmptyEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg11XiphComment7isEmptyEv.stub = !0;
      function __ZNK6TagLib3Ogg4FLAC4File10propertiesEv() {
        return wasmImports._ZNK6TagLib3Ogg4FLAC4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg4FLAC4File10propertiesEv.stub = !0;
      function __ZNK6TagLib3Ogg4FLAC4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib3Ogg4FLAC4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg4FLAC4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib3Ogg4FLAC4File3tagEv() {
        return wasmImports._ZNK6TagLib3Ogg4FLAC4File3tagEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg4FLAC4File3tagEv.stub = !0;
      function __ZNK6TagLib3Ogg4Opus10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib3Ogg4Opus10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg4Opus10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib3Ogg4Opus10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib3Ogg4Opus10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg4Opus10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib3Ogg4Opus10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib3Ogg4Opus10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg4Opus10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib3Ogg4Opus10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib3Ogg4Opus10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg4Opus10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib3Ogg4Opus4File10propertiesEv() {
        return wasmImports._ZNK6TagLib3Ogg4Opus4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg4Opus4File10propertiesEv.stub = !0;
      function __ZNK6TagLib3Ogg4Opus4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib3Ogg4Opus4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg4Opus4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib3Ogg4Opus4File3tagEv() {
        return wasmImports._ZNK6TagLib3Ogg4Opus4File3tagEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg4Opus4File3tagEv.stub = !0;
      function __ZNK6TagLib3Ogg5Speex10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib3Ogg5Speex10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg5Speex10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib3Ogg5Speex10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib3Ogg5Speex10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg5Speex10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib3Ogg5Speex10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib3Ogg5Speex10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg5Speex10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib3Ogg5Speex10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib3Ogg5Speex10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg5Speex10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib3Ogg5Speex4File10propertiesEv() {
        return wasmImports._ZNK6TagLib3Ogg5Speex4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg5Speex4File10propertiesEv.stub = !0;
      function __ZNK6TagLib3Ogg5Speex4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib3Ogg5Speex4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg5Speex4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib3Ogg5Speex4File3tagEv() {
        return wasmImports._ZNK6TagLib3Ogg5Speex4File3tagEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Ogg5Speex4File3tagEv.stub = !0;
      function __ZNK6TagLib3S3M10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib3S3M10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3S3M10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib3S3M4File10propertiesEv() {
        return wasmImports._ZNK6TagLib3S3M4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3S3M4File10propertiesEv.stub = !0;
      function __ZNK6TagLib3S3M4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib3S3M4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3S3M4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib3S3M4File3tagEv() {
        return wasmImports._ZNK6TagLib3S3M4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib3S3M4File3tagEv.stub = !0;
      function __ZNK6TagLib3Tag10propertiesEv() {
        return wasmImports._ZNK6TagLib3Tag10propertiesEv.apply(null, arguments);
      }
      __ZNK6TagLib3Tag10propertiesEv.stub = !0;
      function __ZNK6TagLib3Tag17complexPropertiesERKNS_6StringE() {
        return wasmImports._ZNK6TagLib3Tag17complexPropertiesERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Tag17complexPropertiesERKNS_6StringE.stub = !0;
      function __ZNK6TagLib3Tag19complexPropertyKeysEv() {
        return wasmImports._ZNK6TagLib3Tag19complexPropertyKeysEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib3Tag19complexPropertyKeysEv.stub = !0;
      function __ZNK6TagLib3Tag7isEmptyEv() {
        return wasmImports._ZNK6TagLib3Tag7isEmptyEv.apply(null, arguments);
      }
      __ZNK6TagLib3Tag7isEmptyEv.stub = !0;
      function __ZNK6TagLib4FLAC10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib4FLAC10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib4FLAC10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib4FLAC10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib4FLAC10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib4FLAC10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib4FLAC10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib4FLAC10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib4FLAC20UnknownMetadataBlock4codeEv() {
        return wasmImports._ZNK6TagLib4FLAC20UnknownMetadataBlock4codeEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC20UnknownMetadataBlock4codeEv.stub = !0;
      function __ZNK6TagLib4FLAC20UnknownMetadataBlock6renderEv() {
        return wasmImports._ZNK6TagLib4FLAC20UnknownMetadataBlock6renderEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC20UnknownMetadataBlock6renderEv.stub = !0;
      function __ZNK6TagLib4FLAC4File10propertiesEv() {
        return wasmImports._ZNK6TagLib4FLAC4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC4File10propertiesEv.stub = !0;
      function __ZNK6TagLib4FLAC4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib4FLAC4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib4FLAC4File17complexPropertiesERKNS_6StringE() {
        return wasmImports._ZNK6TagLib4FLAC4File17complexPropertiesERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC4File17complexPropertiesERKNS_6StringE.stub = !0;
      function __ZNK6TagLib4FLAC4File19complexPropertyKeysEv() {
        return wasmImports._ZNK6TagLib4FLAC4File19complexPropertyKeysEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC4File19complexPropertyKeysEv.stub = !0;
      function __ZNK6TagLib4FLAC4File3tagEv() {
        return wasmImports._ZNK6TagLib4FLAC4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib4FLAC4File3tagEv.stub = !0;
      function __ZNK6TagLib4FLAC7Picture4codeEv() {
        return wasmImports._ZNK6TagLib4FLAC7Picture4codeEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC7Picture4codeEv.stub = !0;
      function __ZNK6TagLib4FLAC7Picture6renderEv() {
        return wasmImports._ZNK6TagLib4FLAC7Picture6renderEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4FLAC7Picture6renderEv.stub = !0;
      function __ZNK6TagLib4File10propertiesEv() {
        return wasmImports._ZNK6TagLib4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4File10propertiesEv.stub = !0;
      function __ZNK6TagLib4File17complexPropertiesERKNS_6StringE() {
        return wasmImports._ZNK6TagLib4File17complexPropertiesERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4File17complexPropertiesERKNS_6StringE.stub = !0;
      function __ZNK6TagLib4File19complexPropertyKeysEv() {
        return wasmImports._ZNK6TagLib4File19complexPropertyKeysEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4File19complexPropertyKeysEv.stub = !0;
      function __ZNK6TagLib4MPEG10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib4MPEG10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4MPEG10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib4MPEG10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib4MPEG10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4MPEG10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib4MPEG10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib4MPEG10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4MPEG10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib4MPEG10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib4MPEG10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4MPEG10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib4MPEG4File10propertiesEv() {
        return wasmImports._ZNK6TagLib4MPEG4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4MPEG4File10propertiesEv.stub = !0;
      function __ZNK6TagLib4MPEG4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib4MPEG4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4MPEG4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib4MPEG4File3tagEv() {
        return wasmImports._ZNK6TagLib4MPEG4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib4MPEG4File3tagEv.stub = !0;
      function __ZNK6TagLib4RIFF3WAV10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib4RIFF3WAV10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF3WAV10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib4RIFF3WAV10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib4RIFF3WAV10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF3WAV10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib4RIFF3WAV10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib4RIFF3WAV10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF3WAV10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib4RIFF3WAV10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib4RIFF3WAV10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF3WAV10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib4RIFF3WAV4File10propertiesEv() {
        return wasmImports._ZNK6TagLib4RIFF3WAV4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF3WAV4File10propertiesEv.stub = !0;
      function __ZNK6TagLib4RIFF3WAV4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib4RIFF3WAV4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF3WAV4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib4RIFF3WAV4File3tagEv() {
        return wasmImports._ZNK6TagLib4RIFF3WAV4File3tagEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF3WAV4File3tagEv.stub = !0;
      function __ZNK6TagLib4RIFF4AIFF10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib4RIFF4AIFF10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4AIFF10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib4RIFF4AIFF10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib4RIFF4AIFF10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4AIFF10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib4RIFF4AIFF10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib4RIFF4AIFF10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4AIFF10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib4RIFF4AIFF10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib4RIFF4AIFF10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4AIFF10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib4RIFF4AIFF4File10propertiesEv() {
        return wasmImports._ZNK6TagLib4RIFF4AIFF4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4AIFF4File10propertiesEv.stub = !0;
      function __ZNK6TagLib4RIFF4AIFF4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib4RIFF4AIFF4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4AIFF4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib4RIFF4AIFF4File3tagEv() {
        return wasmImports._ZNK6TagLib4RIFF4AIFF4File3tagEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4AIFF4File3tagEv.stub = !0;
      function __ZNK6TagLib4RIFF4Info13StringHandler5parseERKNS_10ByteVectorE() {
        return wasmImports._ZNK6TagLib4RIFF4Info13StringHandler5parseERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info13StringHandler5parseERKNS_10ByteVectorE.stub = !0;
      function __ZNK6TagLib4RIFF4Info13StringHandler6renderERKNS_6StringE() {
        return wasmImports._ZNK6TagLib4RIFF4Info13StringHandler6renderERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info13StringHandler6renderERKNS_6StringE.stub = !0;
      function __ZNK6TagLib4RIFF4Info3Tag10propertiesEv() {
        return wasmImports._ZNK6TagLib4RIFF4Info3Tag10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info3Tag10propertiesEv.stub = !0;
      function __ZNK6TagLib4RIFF4Info3Tag4yearEv() {
        return wasmImports._ZNK6TagLib4RIFF4Info3Tag4yearEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info3Tag4yearEv.stub = !0;
      function __ZNK6TagLib4RIFF4Info3Tag5albumEv() {
        return wasmImports._ZNK6TagLib4RIFF4Info3Tag5albumEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info3Tag5albumEv.stub = !0;
      function __ZNK6TagLib4RIFF4Info3Tag5genreEv() {
        return wasmImports._ZNK6TagLib4RIFF4Info3Tag5genreEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info3Tag5genreEv.stub = !0;
      function __ZNK6TagLib4RIFF4Info3Tag5titleEv() {
        return wasmImports._ZNK6TagLib4RIFF4Info3Tag5titleEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info3Tag5titleEv.stub = !0;
      function __ZNK6TagLib4RIFF4Info3Tag5trackEv() {
        return wasmImports._ZNK6TagLib4RIFF4Info3Tag5trackEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info3Tag5trackEv.stub = !0;
      function __ZNK6TagLib4RIFF4Info3Tag6artistEv() {
        return wasmImports._ZNK6TagLib4RIFF4Info3Tag6artistEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info3Tag6artistEv.stub = !0;
      function __ZNK6TagLib4RIFF4Info3Tag7commentEv() {
        return wasmImports._ZNK6TagLib4RIFF4Info3Tag7commentEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info3Tag7commentEv.stub = !0;
      function __ZNK6TagLib4RIFF4Info3Tag7isEmptyEv() {
        return wasmImports._ZNK6TagLib4RIFF4Info3Tag7isEmptyEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib4RIFF4Info3Tag7isEmptyEv.stub = !0;
      function __ZNK6TagLib5ID3v113StringHandler5parseERKNS_10ByteVectorE() {
        return wasmImports._ZNK6TagLib5ID3v113StringHandler5parseERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v113StringHandler5parseERKNS_10ByteVectorE.stub = !0;
      function __ZNK6TagLib5ID3v113StringHandler6renderERKNS_6StringE() {
        return wasmImports._ZNK6TagLib5ID3v113StringHandler6renderERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v113StringHandler6renderERKNS_6StringE.stub = !0;
      function __ZNK6TagLib5ID3v13Tag4yearEv() {
        return wasmImports._ZNK6TagLib5ID3v13Tag4yearEv.apply(null, arguments);
      }
      __ZNK6TagLib5ID3v13Tag4yearEv.stub = !0;
      function __ZNK6TagLib5ID3v13Tag5albumEv() {
        return wasmImports._ZNK6TagLib5ID3v13Tag5albumEv.apply(null, arguments);
      }
      __ZNK6TagLib5ID3v13Tag5albumEv.stub = !0;
      function __ZNK6TagLib5ID3v13Tag5genreEv() {
        return wasmImports._ZNK6TagLib5ID3v13Tag5genreEv.apply(null, arguments);
      }
      __ZNK6TagLib5ID3v13Tag5genreEv.stub = !0;
      function __ZNK6TagLib5ID3v13Tag5titleEv() {
        return wasmImports._ZNK6TagLib5ID3v13Tag5titleEv.apply(null, arguments);
      }
      __ZNK6TagLib5ID3v13Tag5titleEv.stub = !0;
      function __ZNK6TagLib5ID3v13Tag5trackEv() {
        return wasmImports._ZNK6TagLib5ID3v13Tag5trackEv.apply(null, arguments);
      }
      __ZNK6TagLib5ID3v13Tag5trackEv.stub = !0;
      function __ZNK6TagLib5ID3v13Tag6artistEv() {
        return wasmImports._ZNK6TagLib5ID3v13Tag6artistEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v13Tag6artistEv.stub = !0;
      function __ZNK6TagLib5ID3v13Tag7commentEv() {
        return wasmImports._ZNK6TagLib5ID3v13Tag7commentEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v13Tag7commentEv.stub = !0;
      function __ZNK6TagLib5ID3v212ChapterFrame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v212ChapterFrame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212ChapterFrame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v212ChapterFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v212ChapterFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212ChapterFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v212ChapterFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v212ChapterFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212ChapterFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v212FrameFactory11createFrameERKNS_10ByteVectorEPKNS0_6HeaderE() {
        return wasmImports._ZNK6TagLib5ID3v212FrameFactory11createFrameERKNS_10ByteVectorEPKNS0_6HeaderE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212FrameFactory11createFrameERKNS_10ByteVectorEPKNS0_6HeaderE.stub =
        !0;
      function __ZNK6TagLib5ID3v212FrameFactory11createFrameERKNS_10ByteVectorEPNS0_5Frame6HeaderEPKNS0_6HeaderE() {
        return wasmImports._ZNK6TagLib5ID3v212FrameFactory11createFrameERKNS_10ByteVectorEPNS0_5Frame6HeaderEPKNS0_6HeaderE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212FrameFactory11createFrameERKNS_10ByteVectorEPNS0_5Frame6HeaderEPKNS0_6HeaderE.stub =
        !0;
      function __ZNK6TagLib5ID3v212FrameFactory11updateFrameEPNS0_5Frame6HeaderE() {
        return wasmImports._ZNK6TagLib5ID3v212FrameFactory11updateFrameEPNS0_5Frame6HeaderE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212FrameFactory11updateFrameEPNS0_5Frame6HeaderE.stub =
        !0;
      function __ZNK6TagLib5ID3v212FrameFactory22createFrameForPropertyERKNS_6StringERKNS_10StringListE() {
        return wasmImports._ZNK6TagLib5ID3v212FrameFactory22createFrameForPropertyERKNS_6StringERKNS_10StringListE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212FrameFactory22createFrameForPropertyERKNS_6StringERKNS_10StringListE.stub =
        !0;
      function __ZNK6TagLib5ID3v212FrameFactory22rebuildAggregateFramesEPNS0_3TagE() {
        return wasmImports._ZNK6TagLib5ID3v212FrameFactory22rebuildAggregateFramesEPNS0_3TagE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212FrameFactory22rebuildAggregateFramesEPNS0_3TagE.stub =
        !0;
      function __ZNK6TagLib5ID3v212PodcastFrame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v212PodcastFrame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212PodcastFrame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v212PodcastFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v212PodcastFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212PodcastFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v212PodcastFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v212PodcastFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212PodcastFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v212PrivateFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v212PrivateFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212PrivateFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v212PrivateFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v212PrivateFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212PrivateFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v212UnknownFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v212UnknownFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212UnknownFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v212UnknownFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v212UnknownFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212UnknownFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v212UrlLinkFrame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v212UrlLinkFrame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212UrlLinkFrame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v212UrlLinkFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v212UrlLinkFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212UrlLinkFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v212UrlLinkFrame3urlEv() {
        return wasmImports._ZNK6TagLib5ID3v212UrlLinkFrame3urlEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212UrlLinkFrame3urlEv.stub = !0;
      function __ZNK6TagLib5ID3v212UrlLinkFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v212UrlLinkFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v212UrlLinkFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v213CommentsFrame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v213CommentsFrame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v213CommentsFrame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v213CommentsFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v213CommentsFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v213CommentsFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v213CommentsFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v213CommentsFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v213CommentsFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v214OwnershipFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v214OwnershipFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v214OwnershipFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v214OwnershipFrame12toStringListEv() {
        return wasmImports._ZNK6TagLib5ID3v214OwnershipFrame12toStringListEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v214OwnershipFrame12toStringListEv.stub = !0;
      function __ZNK6TagLib5ID3v214OwnershipFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v214OwnershipFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v214OwnershipFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v216UserUrlLinkFrame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v216UserUrlLinkFrame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v216UserUrlLinkFrame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v216UserUrlLinkFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v216UserUrlLinkFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v216UserUrlLinkFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v216UserUrlLinkFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v216UserUrlLinkFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v216UserUrlLinkFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v218PopularimeterFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v218PopularimeterFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v218PopularimeterFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v218PopularimeterFrame12toStringListEv() {
        return wasmImports._ZNK6TagLib5ID3v218PopularimeterFrame12toStringListEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v218PopularimeterFrame12toStringListEv.stub = !0;
      function __ZNK6TagLib5ID3v218PopularimeterFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v218PopularimeterFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v218PopularimeterFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v219Latin1StringHandler5parseERKNS_10ByteVectorE() {
        return wasmImports._ZNK6TagLib5ID3v219Latin1StringHandler5parseERKNS_10ByteVectorE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v219Latin1StringHandler5parseERKNS_10ByteVectorE.stub =
        !0;
      function __ZNK6TagLib5ID3v219RelativeVolumeFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v219RelativeVolumeFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v219RelativeVolumeFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v219RelativeVolumeFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v219RelativeVolumeFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v219RelativeVolumeFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v220AttachedPictureFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v220AttachedPictureFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v220AttachedPictureFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v220AttachedPictureFrame12toStringListEv() {
        return wasmImports._ZNK6TagLib5ID3v220AttachedPictureFrame12toStringListEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v220AttachedPictureFrame12toStringListEv.stub = !0;
      function __ZNK6TagLib5ID3v220AttachedPictureFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v220AttachedPictureFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v220AttachedPictureFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v220TableOfContentsFrame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v220TableOfContentsFrame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v220TableOfContentsFrame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v220TableOfContentsFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v220TableOfContentsFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v220TableOfContentsFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v220TableOfContentsFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v220TableOfContentsFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v220TableOfContentsFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v221EventTimingCodesFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v221EventTimingCodesFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v221EventTimingCodesFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v221EventTimingCodesFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v221EventTimingCodesFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v221EventTimingCodesFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v223SynchronizedLyricsFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v223SynchronizedLyricsFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v223SynchronizedLyricsFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v223SynchronizedLyricsFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v223SynchronizedLyricsFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v223SynchronizedLyricsFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v223TextIdentificationFrame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v223TextIdentificationFrame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v223TextIdentificationFrame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v223TextIdentificationFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v223TextIdentificationFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v223TextIdentificationFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v223TextIdentificationFrame12toStringListEv() {
        return wasmImports._ZNK6TagLib5ID3v223TextIdentificationFrame12toStringListEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v223TextIdentificationFrame12toStringListEv.stub = !0;
      function __ZNK6TagLib5ID3v223TextIdentificationFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v223TextIdentificationFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v223TextIdentificationFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v225UniqueFileIdentifierFrame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v225UniqueFileIdentifierFrame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v225UniqueFileIdentifierFrame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v225UniqueFileIdentifierFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v225UniqueFileIdentifierFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v225UniqueFileIdentifierFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v225UniqueFileIdentifierFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v225UniqueFileIdentifierFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v225UniqueFileIdentifierFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame12renderFieldsEv.stub = !0;
      function __ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v227UserTextIdentificationFrame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v227UserTextIdentificationFrame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v227UserTextIdentificationFrame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v227UserTextIdentificationFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v227UserTextIdentificationFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v227UserTextIdentificationFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame12renderFieldsEv() {
        return wasmImports._ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame12renderFieldsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame12renderFieldsEv.stub =
        !0;
      function __ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame12toStringListEv() {
        return wasmImports._ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame12toStringListEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame12toStringListEv.stub =
        !0;
      function __ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame8toStringEv() {
        return wasmImports._ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame8toStringEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame8toStringEv.stub = !0;
      function __ZNK6TagLib5ID3v23Tag10propertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v23Tag10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v23Tag10propertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v23Tag17complexPropertiesERKNS_6StringE() {
        return wasmImports._ZNK6TagLib5ID3v23Tag17complexPropertiesERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v23Tag17complexPropertiesERKNS_6StringE.stub = !0;
      function __ZNK6TagLib5ID3v23Tag19complexPropertyKeysEv() {
        return wasmImports._ZNK6TagLib5ID3v23Tag19complexPropertyKeysEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v23Tag19complexPropertyKeysEv.stub = !0;
      function __ZNK6TagLib5ID3v23Tag4yearEv() {
        return wasmImports._ZNK6TagLib5ID3v23Tag4yearEv.apply(null, arguments);
      }
      __ZNK6TagLib5ID3v23Tag4yearEv.stub = !0;
      function __ZNK6TagLib5ID3v23Tag5albumEv() {
        return wasmImports._ZNK6TagLib5ID3v23Tag5albumEv.apply(null, arguments);
      }
      __ZNK6TagLib5ID3v23Tag5albumEv.stub = !0;
      function __ZNK6TagLib5ID3v23Tag5genreEv() {
        return wasmImports._ZNK6TagLib5ID3v23Tag5genreEv.apply(null, arguments);
      }
      __ZNK6TagLib5ID3v23Tag5genreEv.stub = !0;
      function __ZNK6TagLib5ID3v23Tag5titleEv() {
        return wasmImports._ZNK6TagLib5ID3v23Tag5titleEv.apply(null, arguments);
      }
      __ZNK6TagLib5ID3v23Tag5titleEv.stub = !0;
      function __ZNK6TagLib5ID3v23Tag5trackEv() {
        return wasmImports._ZNK6TagLib5ID3v23Tag5trackEv.apply(null, arguments);
      }
      __ZNK6TagLib5ID3v23Tag5trackEv.stub = !0;
      function __ZNK6TagLib5ID3v23Tag6artistEv() {
        return wasmImports._ZNK6TagLib5ID3v23Tag6artistEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v23Tag6artistEv.stub = !0;
      function __ZNK6TagLib5ID3v23Tag7commentEv() {
        return wasmImports._ZNK6TagLib5ID3v23Tag7commentEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v23Tag7commentEv.stub = !0;
      function __ZNK6TagLib5ID3v23Tag7isEmptyEv() {
        return wasmImports._ZNK6TagLib5ID3v23Tag7isEmptyEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v23Tag7isEmptyEv.stub = !0;
      function __ZNK6TagLib5ID3v25Frame12asPropertiesEv() {
        return wasmImports._ZNK6TagLib5ID3v25Frame12asPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v25Frame12asPropertiesEv.stub = !0;
      function __ZNK6TagLib5ID3v25Frame12toStringListEv() {
        return wasmImports._ZNK6TagLib5ID3v25Frame12toStringListEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib5ID3v25Frame12toStringListEv.stub = !0;
      function __ZNK6TagLib6DSDIFF10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib6DSDIFF10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib6DSDIFF10Properties15lengthInSecondsEv() {
        return wasmImports._ZNK6TagLib6DSDIFF10Properties15lengthInSecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF10Properties15lengthInSecondsEv.stub = !0;
      function __ZNK6TagLib6DSDIFF10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib6DSDIFF10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib6DSDIFF10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib6DSDIFF10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib6DSDIFF10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib6DSDIFF10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4DIIN3Tag10propertiesEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4DIIN3Tag10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF4DIIN3Tag10propertiesEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4DIIN3Tag4yearEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4DIIN3Tag4yearEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF4DIIN3Tag4yearEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4DIIN3Tag5albumEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4DIIN3Tag5albumEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF4DIIN3Tag5albumEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4DIIN3Tag5genreEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4DIIN3Tag5genreEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF4DIIN3Tag5genreEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4DIIN3Tag5titleEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4DIIN3Tag5titleEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF4DIIN3Tag5titleEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4DIIN3Tag5trackEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4DIIN3Tag5trackEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF4DIIN3Tag5trackEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4DIIN3Tag6artistEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4DIIN3Tag6artistEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF4DIIN3Tag6artistEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4DIIN3Tag7commentEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4DIIN3Tag7commentEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF4DIIN3Tag7commentEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4File10propertiesEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF4File10propertiesEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6DSDIFF4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib6DSDIFF4File3tagEv() {
        return wasmImports._ZNK6TagLib6DSDIFF4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib6DSDIFF4File3tagEv.stub = !0;
      function __ZNK6TagLib6String4sizeEv() {
        return wasmImports._ZNK6TagLib6String4sizeEv.apply(null, arguments);
      }
      __ZNK6TagLib6String4sizeEv.stub = !0;
      function __ZNK6TagLib6String6to8BitEb() {
        return wasmImports._ZNK6TagLib6String6to8BitEb.apply(null, arguments);
      }
      __ZNK6TagLib6String6to8BitEb.stub = !0;
      function __ZNK6TagLib6StringltERKS0_() {
        return wasmImports._ZNK6TagLib6StringltERKS0_.apply(null, arguments);
      }
      __ZNK6TagLib6StringltERKS0_.stub = !0;
      function __ZNK6TagLib6Vorbis10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib6Vorbis10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6Vorbis10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib6Vorbis10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib6Vorbis10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6Vorbis10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib6Vorbis10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib6Vorbis10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6Vorbis10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib6Vorbis10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib6Vorbis10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6Vorbis10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib6Vorbis4File10propertiesEv() {
        return wasmImports._ZNK6TagLib6Vorbis4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6Vorbis4File10propertiesEv.stub = !0;
      function __ZNK6TagLib6Vorbis4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib6Vorbis4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib6Vorbis4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib6Vorbis4File3tagEv() {
        return wasmImports._ZNK6TagLib6Vorbis4File3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib6Vorbis4File3tagEv.stub = !0;
      function __ZNK6TagLib7FileRef10propertiesEv() {
        return wasmImports._ZNK6TagLib7FileRef10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7FileRef10propertiesEv.stub = !0;
      function __ZNK6TagLib7FileRef15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib7FileRef15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7FileRef15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib7FileRef17complexPropertiesERKNS_6StringE() {
        return wasmImports._ZNK6TagLib7FileRef17complexPropertiesERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7FileRef17complexPropertiesERKNS_6StringE.stub = !0;
      function __ZNK6TagLib7FileRef19complexPropertyKeysEv() {
        return wasmImports._ZNK6TagLib7FileRef19complexPropertyKeysEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7FileRef19complexPropertyKeysEv.stub = !0;
      function __ZNK6TagLib7FileRef3tagEv() {
        return wasmImports._ZNK6TagLib7FileRef3tagEv.apply(null, arguments);
      }
      __ZNK6TagLib7FileRef3tagEv.stub = !0;
      function __ZNK6TagLib7FileRef6isNullEv() {
        return wasmImports._ZNK6TagLib7FileRef6isNullEv.apply(null, arguments);
      }
      __ZNK6TagLib7FileRef6isNullEv.stub = !0;
      function __ZNK6TagLib7Variant4typeEv() {
        return wasmImports._ZNK6TagLib7Variant4typeEv.apply(null, arguments);
      }
      __ZNK6TagLib7Variant4typeEv.stub = !0;
      function __ZNK6TagLib7Variant5valueINS_10ByteVectorEEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueINS_10ByteVectorEEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueINS_10ByteVectorEEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueINS_10StringListEEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueINS_10StringListEEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueINS_10StringListEEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueINS_14ByteVectorListEEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueINS_14ByteVectorListEEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueINS_14ByteVectorListEEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueINS_3MapINS_6StringES0_EEEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueINS_3MapINS_6StringES0_EEEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueINS_3MapINS_6StringES0_EEEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueINS_4ListIS0_EEEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueINS_4ListIS0_EEEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueINS_4ListIS0_EEEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueINS_6StringEEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueINS_6StringEEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueINS_6StringEEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueIbEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueIbEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueIbEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueIdEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueIdEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueIdEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueIiEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueIiEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueIiEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueIjEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueIjEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueIjEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueIxEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueIxEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueIxEET_Pb.stub = !0;
      function __ZNK6TagLib7Variant5valueIyEET_Pb() {
        return wasmImports._ZNK6TagLib7Variant5valueIyEET_Pb.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7Variant5valueIyEET_Pb.stub = !0;
      function __ZNK6TagLib7WavPack10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib7WavPack10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7WavPack10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib7WavPack10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib7WavPack10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7WavPack10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib7WavPack10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib7WavPack10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7WavPack10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib7WavPack10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib7WavPack10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7WavPack10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib7WavPack4File10propertiesEv() {
        return wasmImports._ZNK6TagLib7WavPack4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7WavPack4File10propertiesEv.stub = !0;
      function __ZNK6TagLib7WavPack4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib7WavPack4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7WavPack4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib7WavPack4File3tagEv() {
        return wasmImports._ZNK6TagLib7WavPack4File3tagEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib7WavPack4File3tagEv.stub = !0;
      function __ZNK6TagLib8TagUnion10propertiesEv() {
        return wasmImports._ZNK6TagLib8TagUnion10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib8TagUnion10propertiesEv.stub = !0;
      function __ZNK6TagLib8TagUnion17complexPropertiesERKNS_6StringE() {
        return wasmImports._ZNK6TagLib8TagUnion17complexPropertiesERKNS_6StringE.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib8TagUnion17complexPropertiesERKNS_6StringE.stub = !0;
      function __ZNK6TagLib8TagUnion19complexPropertyKeysEv() {
        return wasmImports._ZNK6TagLib8TagUnion19complexPropertyKeysEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib8TagUnion19complexPropertyKeysEv.stub = !0;
      function __ZNK6TagLib8TagUnion4yearEv() {
        return wasmImports._ZNK6TagLib8TagUnion4yearEv.apply(null, arguments);
      }
      __ZNK6TagLib8TagUnion4yearEv.stub = !0;
      function __ZNK6TagLib8TagUnion5albumEv() {
        return wasmImports._ZNK6TagLib8TagUnion5albumEv.apply(null, arguments);
      }
      __ZNK6TagLib8TagUnion5albumEv.stub = !0;
      function __ZNK6TagLib8TagUnion5genreEv() {
        return wasmImports._ZNK6TagLib8TagUnion5genreEv.apply(null, arguments);
      }
      __ZNK6TagLib8TagUnion5genreEv.stub = !0;
      function __ZNK6TagLib8TagUnion5titleEv() {
        return wasmImports._ZNK6TagLib8TagUnion5titleEv.apply(null, arguments);
      }
      __ZNK6TagLib8TagUnion5titleEv.stub = !0;
      function __ZNK6TagLib8TagUnion5trackEv() {
        return wasmImports._ZNK6TagLib8TagUnion5trackEv.apply(null, arguments);
      }
      __ZNK6TagLib8TagUnion5trackEv.stub = !0;
      function __ZNK6TagLib8TagUnion6artistEv() {
        return wasmImports._ZNK6TagLib8TagUnion6artistEv.apply(null, arguments);
      }
      __ZNK6TagLib8TagUnion6artistEv.stub = !0;
      function __ZNK6TagLib8TagUnion7commentEv() {
        return wasmImports._ZNK6TagLib8TagUnion7commentEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib8TagUnion7commentEv.stub = !0;
      function __ZNK6TagLib8TagUnion7isEmptyEv() {
        return wasmImports._ZNK6TagLib8TagUnion7isEmptyEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib8TagUnion7isEmptyEv.stub = !0;
      function __ZNK6TagLib9TrueAudio10Properties10sampleRateEv() {
        return wasmImports._ZNK6TagLib9TrueAudio10Properties10sampleRateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib9TrueAudio10Properties10sampleRateEv.stub = !0;
      function __ZNK6TagLib9TrueAudio10Properties15lengthInSecondsEv() {
        return wasmImports._ZNK6TagLib9TrueAudio10Properties15lengthInSecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib9TrueAudio10Properties15lengthInSecondsEv.stub = !0;
      function __ZNK6TagLib9TrueAudio10Properties20lengthInMillisecondsEv() {
        return wasmImports._ZNK6TagLib9TrueAudio10Properties20lengthInMillisecondsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib9TrueAudio10Properties20lengthInMillisecondsEv.stub = !0;
      function __ZNK6TagLib9TrueAudio10Properties7bitrateEv() {
        return wasmImports._ZNK6TagLib9TrueAudio10Properties7bitrateEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib9TrueAudio10Properties7bitrateEv.stub = !0;
      function __ZNK6TagLib9TrueAudio10Properties8channelsEv() {
        return wasmImports._ZNK6TagLib9TrueAudio10Properties8channelsEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib9TrueAudio10Properties8channelsEv.stub = !0;
      function __ZNK6TagLib9TrueAudio4File10propertiesEv() {
        return wasmImports._ZNK6TagLib9TrueAudio4File10propertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib9TrueAudio4File10propertiesEv.stub = !0;
      function __ZNK6TagLib9TrueAudio4File15audioPropertiesEv() {
        return wasmImports._ZNK6TagLib9TrueAudio4File15audioPropertiesEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib9TrueAudio4File15audioPropertiesEv.stub = !0;
      function __ZNK6TagLib9TrueAudio4File3tagEv() {
        return wasmImports._ZNK6TagLib9TrueAudio4File3tagEv.apply(
          null,
          arguments
        );
      }
      __ZNK6TagLib9TrueAudio4File3tagEv.stub = !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm0ELm0EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm0ELm0EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm0ELm0EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm10ELm10EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm10ELm10EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm10ELm10EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm11ELm11EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm11ELm11EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm11ELm11EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm12ELm12EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm12ELm12EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm12ELm12EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm1ELm1EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm1ELm1EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm1ELm1EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm2ELm2EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm2ELm2EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm2ELm2EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm3ELm3EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm3ELm3EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm3ELm3EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm4ELm4EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm4ELm4EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm4ELm4EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm5ELm5EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm5ELm5EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm5ELm5EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm6ELm6EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm6ELm6EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm6ELm6EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm7ELm7EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm7ELm7EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm7ELm7EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm8ELm8EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm8ELm8EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm8ELm8EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm9ELm9EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_() {
        return wasmImports._ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm9ELm9EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm9ELm9EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_.stub =
        !0;
      function __ZNSt3__219piecewise_constructE() {
        return wasmImports._ZNSt3__219piecewise_constructE.apply(
          null,
          arguments
        );
      }
      __ZNSt3__219piecewise_constructE.stub = !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEED2Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEED0Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEED0Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEED0Ev.stub =
        !0;
      function __ZNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEED2Ev() {
        return wasmImports._ZNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEED2Ev.apply(
          null,
          arguments
        );
      }
      __ZNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEED2Ev.stub =
        !0;
      function __ZNSt3__23mapIN6TagLib10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeENS_4lessIS2_EENS_9allocatorINS_4pairIKS2_S5_EEEEE6insertB8ue170004IPKSB_EEvT_SH_() {
        return wasmImports._ZNSt3__23mapIN6TagLib10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeENS_4lessIS2_EENS_9allocatorINS_4pairIKS2_S5_EEEEE6insertB8ue170004IPKSB_EEvT_SH_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__23mapIN6TagLib10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeENS_4lessIS2_EENS_9allocatorINS_4pairIKS2_S5_EEEEE6insertB8ue170004IPKSB_EEvT_SH_.stub =
        !0;
      function __ZNSt3__23mapIN6TagLib6StringEiNS_4lessIS2_EENS_9allocatorINS_4pairIKS2_iEEEEE6insertB8ue170004INS_20__map_const_iteratorINS_21__tree_const_iteratorINS_12__value_typeIS2_iEEPNS_11__tree_nodeISF_PvEElEEEEEEvT_SM_() {
        return wasmImports._ZNSt3__23mapIN6TagLib6StringEiNS_4lessIS2_EENS_9allocatorINS_4pairIKS2_iEEEEE6insertB8ue170004INS_20__map_const_iteratorINS_21__tree_const_iteratorINS_12__value_typeIS2_iEEPNS_11__tree_nodeISF_PvEElEEEEEEvT_SM_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__23mapIN6TagLib6StringEiNS_4lessIS2_EENS_9allocatorINS_4pairIKS2_iEEEEE6insertB8ue170004INS_20__map_const_iteratorINS_21__tree_const_iteratorINS_12__value_typeIS2_iEEPNS_11__tree_nodeISF_PvEElEEEEEEvT_SM_.stub =
        !0;
      function __ZNSt3__23mapIjN6TagLib10ByteVectorENS_4lessIjEENS_9allocatorINS_4pairIKjS2_EEEEE6insertB8ue170004INS_20__map_const_iteratorINS_21__tree_const_iteratorINS_12__value_typeIjS2_EEPNS_11__tree_nodeISF_PvEElEEEEEEvT_SM_() {
        return wasmImports._ZNSt3__23mapIjN6TagLib10ByteVectorENS_4lessIjEENS_9allocatorINS_4pairIKjS2_EEEEE6insertB8ue170004INS_20__map_const_iteratorINS_21__tree_const_iteratorINS_12__value_typeIjS2_EEPNS_11__tree_nodeISF_PvEElEEEEEEvT_SM_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__23mapIjN6TagLib10ByteVectorENS_4lessIjEENS_9allocatorINS_4pairIKjS2_EEEEE6insertB8ue170004INS_20__map_const_iteratorINS_21__tree_const_iteratorINS_12__value_typeIjS2_EEPNS_11__tree_nodeISF_PvEElEEEEEEvT_SM_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE14__erase_uniqueIS3_EEmRKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE14__erase_uniqueIS3_EEmRKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE14__erase_uniqueIS3_EEmRKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRS4_EEENSJ_IJEEEEEENS_4pairINS_15__tree_iteratorIS7_PNS_11__tree_nodeIS7_PvEElEEbEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRS4_EEENSJ_IJEEEEEENS_4pairINS_15__tree_iteratorIS7_PNS_11__tree_nodeIS7_PvEElEEbEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRS4_EEENSJ_IJEEEEEENS_4pairINS_15__tree_iteratorIS7_PNS_11__tree_nodeIS7_PvEElEEbEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIS4_S6_EEEEENSG_INS_15__tree_iteratorIS7_PNS_11__tree_nodeIS7_PvEElEEbEENS_21__tree_const_iteratorIS7_SO_lEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIS4_S6_EEEEENSG_INS_15__tree_iteratorIS7_PNS_11__tree_nodeIS7_PvEElEEbEENS_21__tree_const_iteratorIS7_SO_lEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIS4_S6_EEEEENSG_INS_15__tree_iteratorIS7_PNS_11__tree_nodeIS7_PvEElEEbEENS_21__tree_const_iteratorIS7_SO_lEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_3MP411ItemFactory15ItemHandlerTypeEEENS_19__map_value_compareIS3_S7_NS_4lessIS3_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_3MP411ItemFactory15ItemHandlerTypeEEENS_19__map_value_compareIS3_S7_NS_4lessIS3_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_3MP411ItemFactory15ItemHandlerTypeEEENS_19__map_value_compareIS3_S7_NS_4lessIS3_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS9_PNS_11__tree_nodeIS9_SJ_EElEERPNS_15__tree_end_nodeISL_EESM_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS9_PNS_11__tree_nodeIS9_SJ_EElEERPNS_15__tree_end_nodeISL_EESM_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS9_PNS_11__tree_nodeIS9_SJ_EElEERPNS_15__tree_end_nodeISL_EESM_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSL_IJEEEEEENS_4pairINS_15__tree_iteratorIS9_PNS_11__tree_nodeIS9_PvEElEEbEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSL_IJEEEEEENS_4pairINS_15__tree_iteratorIS9_PNS_11__tree_nodeIS9_PvEElEEbEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSL_IJEEEEEENS_4pairINS_15__tree_iteratorIS9_PNS_11__tree_nodeIS9_PvEElEEbEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S8_EEEEENSI_INS_15__tree_iteratorIS9_PNS_11__tree_nodeIS9_PvEElEEbEENS_21__tree_const_iteratorIS9_SR_lEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S8_EEEEENSI_INS_15__tree_iteratorIS9_PNS_11__tree_nodeIS9_PvEElEEbEENS_21__tree_const_iteratorIS9_SR_lEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S8_EEEEENSI_INS_15__tree_iteratorIS9_PNS_11__tree_nodeIS9_PvEElEEbEENS_21__tree_const_iteratorIS9_SR_lEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE14__erase_uniqueIS3_EEmRKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE14__erase_uniqueIS3_EEmRKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE14__erase_uniqueIS3_EEmRKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataEENS_19__map_value_compareIS5_S7_NS_4lessIS5_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS5_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataEENS_19__map_value_compareIS5_S7_NS_4lessIS5_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS5_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataEENS_19__map_value_compareIS5_S7_NS_4lessIS5_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS5_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE14__erase_uniqueIS3_EEmRKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE14__erase_uniqueIS3_EEmRKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE14__erase_uniqueIS3_EEmRKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS6_PNS_11__tree_nodeIS6_SG_EElEERPNS_15__tree_end_nodeISI_EESJ_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS6_PNS_11__tree_nodeIS6_SG_EElEERPNS_15__tree_end_nodeISI_EESJ_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS6_PNS_11__tree_nodeIS6_SG_EElEERPNS_15__tree_end_nodeISI_EESJ_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE14__erase_uniqueIS3_EEmRKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE14__erase_uniqueIS3_EEmRKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE14__erase_uniqueIS3_EEmRKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSI_IJEEEEEENS_4pairINS_15__tree_iteratorIS6_PNS_11__tree_nodeIS6_PvEElEEbEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSI_IJEEEEEENS_4pairINS_15__tree_iteratorIS6_PNS_11__tree_nodeIS6_PvEElEEbEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSI_IJEEEEEENS_4pairINS_15__tree_iteratorIS6_PNS_11__tree_nodeIS6_PvEElEEbEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S5_EEEEENSF_INS_15__tree_iteratorIS6_PNS_11__tree_nodeIS6_PvEElEEbEENS_21__tree_const_iteratorIS6_SO_lEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S5_EEEEENSF_INS_15__tree_iteratorIS6_PNS_11__tree_nodeIS6_PvEElEEbEENS_21__tree_const_iteratorIS6_SO_lEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S5_EEEEENSF_INS_15__tree_iteratorIS6_PNS_11__tree_nodeIS6_PvEElEEbEENS_21__tree_const_iteratorIS6_SO_lEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS8_PNS_11__tree_nodeIS8_SI_EElEERPNS_15__tree_end_nodeISK_EESL_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS8_PNS_11__tree_nodeIS8_SI_EElEERPNS_15__tree_end_nodeISK_EESL_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS8_PNS_11__tree_nodeIS8_SI_EElEERPNS_15__tree_end_nodeISK_EESL_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE14__erase_uniqueIS3_EEmRKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE14__erase_uniqueIS3_EEmRKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE14__erase_uniqueIS3_EEmRKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSK_IJEEEEEENS_4pairINS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEElEEbEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSK_IJEEEEEENS_4pairINS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEElEEbEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSK_IJEEEEEENS_4pairINS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEElEEbEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S7_EEEEENSH_INS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEElEEbEENS_21__tree_const_iteratorIS8_SQ_lEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S7_EEEEENSH_INS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEElEEbEENS_21__tree_const_iteratorIS8_SQ_lEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S7_EEEEENSH_INS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEElEEbEENS_21__tree_const_iteratorIS8_SQ_lEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSG_IJEEEEEENS_4pairINS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSG_IJEEEEEENS_4pairINS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSG_IJEEEEEENS_4pairINS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S3_EEEEENSD_INS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEENS_21__tree_const_iteratorIS4_SM_lEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S3_EEEEENSD_INS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEENS_21__tree_const_iteratorIS4_SM_lEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S3_EEEEENSD_INS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEENS_21__tree_const_iteratorIS4_SM_lEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringEiEENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringEiEENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringEiEENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringEiEENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSG_IJEEEEEENS_4pairINS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEERKT_DpOT0_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringEiEENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSG_IJEEEEEENS_4pairINS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEERKT_DpOT0_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringEiEENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSG_IJEEEEEENS_4pairINS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEERKT_DpOT0_.stub =
        !0;
      function __ZNSt3__26__treeINS_12__value_typeIjN6TagLib10ByteVectorEEENS_19__map_value_compareIjS4_NS_4lessIjEELb1EEENS_9allocatorIS4_EEE12__find_equalIjEERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_() {
        return wasmImports._ZNSt3__26__treeINS_12__value_typeIjN6TagLib10ByteVectorEEENS_19__map_value_compareIjS4_NS_4lessIjEELb1EEENS_9allocatorIS4_EEE12__find_equalIjEERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26__treeINS_12__value_typeIjN6TagLib10ByteVectorEEENS_19__map_value_compareIjS4_NS_4lessIjEELb1EEENS_9allocatorIS4_EEE12__find_equalIjEERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_.stub =
        !0;
      function __ZNSt3__26vectorI5ChunkNS_9allocatorIS1_EEE21__push_back_slow_pathIS1_EEvOT_() {
        return wasmImports._ZNSt3__26vectorI5ChunkNS_9allocatorIS1_EEE21__push_back_slow_pathIS1_EEvOT_.apply(
          null,
          arguments
        );
      }
      __ZNSt3__26vectorI5ChunkNS_9allocatorIS1_EEE21__push_back_slow_pathIS1_EEvOT_.stub =
        !0;
      function __ZTIN4utf812invalid_utf8E() {
        return wasmImports._ZTIN4utf812invalid_utf8E.apply(null, arguments);
      }
      __ZTIN4utf812invalid_utf8E.stub = !0;
      function __ZTIN4utf813invalid_utf16E() {
        return wasmImports._ZTIN4utf813invalid_utf16E.apply(null, arguments);
      }
      __ZTIN4utf813invalid_utf16E.stub = !0;
      function __ZTIN4utf815not_enough_roomE() {
        return wasmImports._ZTIN4utf815not_enough_roomE.apply(null, arguments);
      }
      __ZTIN4utf815not_enough_roomE.stub = !0;
      function __ZTIN4utf818invalid_code_pointE() {
        return wasmImports._ZTIN4utf818invalid_code_pointE.apply(
          null,
          arguments
        );
      }
      __ZTIN4utf818invalid_code_pointE.stub = !0;
      function __ZTIN4utf89exceptionE() {
        return wasmImports._ZTIN4utf89exceptionE.apply(null, arguments);
      }
      __ZTIN4utf89exceptionE.stub = !0;
      function __ZTIN6TagLib10FileStreamE() {
        return wasmImports._ZTIN6TagLib10FileStreamE.apply(null, arguments);
      }
      __ZTIN6TagLib10FileStreamE.stub = !0;
      function __ZTIN6TagLib13DebugListenerE() {
        return wasmImports._ZTIN6TagLib13DebugListenerE.apply(null, arguments);
      }
      __ZTIN6TagLib13DebugListenerE.stub = !0;
      function __ZTIN6TagLib15AudioPropertiesE() {
        return wasmImports._ZTIN6TagLib15AudioPropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib15AudioPropertiesE.stub = !0;
      function __ZTIN6TagLib16ByteVectorStreamE() {
        return wasmImports._ZTIN6TagLib16ByteVectorStreamE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib16ByteVectorStreamE.stub = !0;
      function __ZTIN6TagLib2IT10PropertiesE() {
        return wasmImports._ZTIN6TagLib2IT10PropertiesE.apply(null, arguments);
      }
      __ZTIN6TagLib2IT10PropertiesE.stub = !0;
      function __ZTIN6TagLib2IT4FileE() {
        return wasmImports._ZTIN6TagLib2IT4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib2IT4FileE.stub = !0;
      function __ZTIN6TagLib2XM10PropertiesE() {
        return wasmImports._ZTIN6TagLib2XM10PropertiesE.apply(null, arguments);
      }
      __ZTIN6TagLib2XM10PropertiesE.stub = !0;
      function __ZTIN6TagLib2XM4FileE() {
        return wasmImports._ZTIN6TagLib2XM4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib2XM4FileE.stub = !0;
      function __ZTIN6TagLib3APE10PropertiesE() {
        return wasmImports._ZTIN6TagLib3APE10PropertiesE.apply(null, arguments);
      }
      __ZTIN6TagLib3APE10PropertiesE.stub = !0;
      function __ZTIN6TagLib3APE3TagE() {
        return wasmImports._ZTIN6TagLib3APE3TagE.apply(null, arguments);
      }
      __ZTIN6TagLib3APE3TagE.stub = !0;
      function __ZTIN6TagLib3APE4FileE() {
        return wasmImports._ZTIN6TagLib3APE4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3APE4FileE.stub = !0;
      function __ZTIN6TagLib3APE4ItemE() {
        return wasmImports._ZTIN6TagLib3APE4ItemE.apply(null, arguments);
      }
      __ZTIN6TagLib3APE4ItemE.stub = !0;
      function __ZTIN6TagLib3APE6FooterE() {
        return wasmImports._ZTIN6TagLib3APE6FooterE.apply(null, arguments);
      }
      __ZTIN6TagLib3APE6FooterE.stub = !0;
      function __ZTIN6TagLib3ASF10PropertiesE() {
        return wasmImports._ZTIN6TagLib3ASF10PropertiesE.apply(null, arguments);
      }
      __ZTIN6TagLib3ASF10PropertiesE.stub = !0;
      function __ZTIN6TagLib3ASF3TagE() {
        return wasmImports._ZTIN6TagLib3ASF3TagE.apply(null, arguments);
      }
      __ZTIN6TagLib3ASF3TagE.stub = !0;
      function __ZTIN6TagLib3ASF4File11FilePrivate10BaseObjectE() {
        return wasmImports._ZTIN6TagLib3ASF4File11FilePrivate10BaseObjectE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3ASF4File11FilePrivate10BaseObjectE.stub = !0;
      function __ZTIN6TagLib3ASF4File11FilePrivate13UnknownObjectE() {
        return wasmImports._ZTIN6TagLib3ASF4File11FilePrivate13UnknownObjectE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3ASF4File11FilePrivate13UnknownObjectE.stub = !0;
      function __ZTIN6TagLib3ASF4File11FilePrivate14MetadataObjectE() {
        return wasmImports._ZTIN6TagLib3ASF4File11FilePrivate14MetadataObjectE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3ASF4File11FilePrivate14MetadataObjectE.stub = !0;
      function __ZTIN6TagLib3ASF4File11FilePrivate15CodecListObjectE() {
        return wasmImports._ZTIN6TagLib3ASF4File11FilePrivate15CodecListObjectE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3ASF4File11FilePrivate15CodecListObjectE.stub = !0;
      function __ZTIN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE() {
        return wasmImports._ZTIN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE.stub = !0;
      function __ZTIN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE() {
        return wasmImports._ZTIN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE.stub = !0;
      function __ZTIN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE() {
        return wasmImports._ZTIN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE.stub = !0;
      function __ZTIN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE() {
        return wasmImports._ZTIN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE.stub = !0;
      function __ZTIN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE() {
        return wasmImports._ZTIN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE.stub = !0;
      function __ZTIN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE() {
        return wasmImports._ZTIN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE.stub =
        !0;
      function __ZTIN6TagLib3ASF4FileE() {
        return wasmImports._ZTIN6TagLib3ASF4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3ASF4FileE.stub = !0;
      function __ZTIN6TagLib3ASF7PictureE() {
        return wasmImports._ZTIN6TagLib3ASF7PictureE.apply(null, arguments);
      }
      __ZTIN6TagLib3ASF7PictureE.stub = !0;
      function __ZTIN6TagLib3ASF9AttributeE() {
        return wasmImports._ZTIN6TagLib3ASF9AttributeE.apply(null, arguments);
      }
      __ZTIN6TagLib3ASF9AttributeE.stub = !0;
      function __ZTIN6TagLib3DSF10PropertiesE() {
        return wasmImports._ZTIN6TagLib3DSF10PropertiesE.apply(null, arguments);
      }
      __ZTIN6TagLib3DSF10PropertiesE.stub = !0;
      function __ZTIN6TagLib3DSF4FileE() {
        return wasmImports._ZTIN6TagLib3DSF4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3DSF4FileE.stub = !0;
      function __ZTIN6TagLib3MP410PropertiesE() {
        return wasmImports._ZTIN6TagLib3MP410PropertiesE.apply(null, arguments);
      }
      __ZTIN6TagLib3MP410PropertiesE.stub = !0;
      function __ZTIN6TagLib3MP411ItemFactoryE() {
        return wasmImports._ZTIN6TagLib3MP411ItemFactoryE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3MP411ItemFactoryE.stub = !0;
      function __ZTIN6TagLib3MP43TagE() {
        return wasmImports._ZTIN6TagLib3MP43TagE.apply(null, arguments);
      }
      __ZTIN6TagLib3MP43TagE.stub = !0;
      function __ZTIN6TagLib3MP44FileE() {
        return wasmImports._ZTIN6TagLib3MP44FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3MP44FileE.stub = !0;
      function __ZTIN6TagLib3MP44ItemE() {
        return wasmImports._ZTIN6TagLib3MP44ItemE.apply(null, arguments);
      }
      __ZTIN6TagLib3MP44ItemE.stub = !0;
      function __ZTIN6TagLib3MP48CoverArtE() {
        return wasmImports._ZTIN6TagLib3MP48CoverArtE.apply(null, arguments);
      }
      __ZTIN6TagLib3MP48CoverArtE.stub = !0;
      function __ZTIN6TagLib3MPC10PropertiesE() {
        return wasmImports._ZTIN6TagLib3MPC10PropertiesE.apply(null, arguments);
      }
      __ZTIN6TagLib3MPC10PropertiesE.stub = !0;
      function __ZTIN6TagLib3MPC4FileE() {
        return wasmImports._ZTIN6TagLib3MPC4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3MPC4FileE.stub = !0;
      function __ZTIN6TagLib3Mod10PropertiesE() {
        return wasmImports._ZTIN6TagLib3Mod10PropertiesE.apply(null, arguments);
      }
      __ZTIN6TagLib3Mod10PropertiesE.stub = !0;
      function __ZTIN6TagLib3Mod3TagE() {
        return wasmImports._ZTIN6TagLib3Mod3TagE.apply(null, arguments);
      }
      __ZTIN6TagLib3Mod3TagE.stub = !0;
      function __ZTIN6TagLib3Mod4FileE() {
        return wasmImports._ZTIN6TagLib3Mod4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3Mod4FileE.stub = !0;
      function __ZTIN6TagLib3Mod8FileBaseE() {
        return wasmImports._ZTIN6TagLib3Mod8FileBaseE.apply(null, arguments);
      }
      __ZTIN6TagLib3Mod8FileBaseE.stub = !0;
      function __ZTIN6TagLib3Ogg10PageHeaderE() {
        return wasmImports._ZTIN6TagLib3Ogg10PageHeaderE.apply(null, arguments);
      }
      __ZTIN6TagLib3Ogg10PageHeaderE.stub = !0;
      function __ZTIN6TagLib3Ogg11XiphCommentE() {
        return wasmImports._ZTIN6TagLib3Ogg11XiphCommentE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3Ogg11XiphCommentE.stub = !0;
      function __ZTIN6TagLib3Ogg4FLAC4FileE() {
        return wasmImports._ZTIN6TagLib3Ogg4FLAC4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3Ogg4FLAC4FileE.stub = !0;
      function __ZTIN6TagLib3Ogg4FileE() {
        return wasmImports._ZTIN6TagLib3Ogg4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3Ogg4FileE.stub = !0;
      function __ZTIN6TagLib3Ogg4Opus10PropertiesE() {
        return wasmImports._ZTIN6TagLib3Ogg4Opus10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3Ogg4Opus10PropertiesE.stub = !0;
      function __ZTIN6TagLib3Ogg4Opus4FileE() {
        return wasmImports._ZTIN6TagLib3Ogg4Opus4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3Ogg4Opus4FileE.stub = !0;
      function __ZTIN6TagLib3Ogg4PageE() {
        return wasmImports._ZTIN6TagLib3Ogg4PageE.apply(null, arguments);
      }
      __ZTIN6TagLib3Ogg4PageE.stub = !0;
      function __ZTIN6TagLib3Ogg5Speex10PropertiesE() {
        return wasmImports._ZTIN6TagLib3Ogg5Speex10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib3Ogg5Speex10PropertiesE.stub = !0;
      function __ZTIN6TagLib3Ogg5Speex4FileE() {
        return wasmImports._ZTIN6TagLib3Ogg5Speex4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3Ogg5Speex4FileE.stub = !0;
      function __ZTIN6TagLib3S3M10PropertiesE() {
        return wasmImports._ZTIN6TagLib3S3M10PropertiesE.apply(null, arguments);
      }
      __ZTIN6TagLib3S3M10PropertiesE.stub = !0;
      function __ZTIN6TagLib3S3M4FileE() {
        return wasmImports._ZTIN6TagLib3S3M4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib3S3M4FileE.stub = !0;
      function __ZTIN6TagLib3TagE() {
        return wasmImports._ZTIN6TagLib3TagE.apply(null, arguments);
      }
      __ZTIN6TagLib3TagE.stub = !0;
      function __ZTIN6TagLib4FLAC10PropertiesE() {
        return wasmImports._ZTIN6TagLib4FLAC10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib4FLAC10PropertiesE.stub = !0;
      function __ZTIN6TagLib4FLAC13MetadataBlockE() {
        return wasmImports._ZTIN6TagLib4FLAC13MetadataBlockE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib4FLAC13MetadataBlockE.stub = !0;
      function __ZTIN6TagLib4FLAC20UnknownMetadataBlockE() {
        return wasmImports._ZTIN6TagLib4FLAC20UnknownMetadataBlockE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib4FLAC20UnknownMetadataBlockE.stub = !0;
      function __ZTIN6TagLib4FLAC4FileE() {
        return wasmImports._ZTIN6TagLib4FLAC4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib4FLAC4FileE.stub = !0;
      function __ZTIN6TagLib4FLAC7PictureE() {
        return wasmImports._ZTIN6TagLib4FLAC7PictureE.apply(null, arguments);
      }
      __ZTIN6TagLib4FLAC7PictureE.stub = !0;
      function __ZTIN6TagLib4FileE() {
        return wasmImports._ZTIN6TagLib4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib4FileE.stub = !0;
      function __ZTIN6TagLib4MPEG10PropertiesE() {
        return wasmImports._ZTIN6TagLib4MPEG10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib4MPEG10PropertiesE.stub = !0;
      function __ZTIN6TagLib4MPEG10XingHeaderE() {
        return wasmImports._ZTIN6TagLib4MPEG10XingHeaderE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib4MPEG10XingHeaderE.stub = !0;
      function __ZTIN6TagLib4MPEG4FileE() {
        return wasmImports._ZTIN6TagLib4MPEG4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib4MPEG4FileE.stub = !0;
      function __ZTIN6TagLib4MPEG6HeaderE() {
        return wasmImports._ZTIN6TagLib4MPEG6HeaderE.apply(null, arguments);
      }
      __ZTIN6TagLib4MPEG6HeaderE.stub = !0;
      function __ZTIN6TagLib4RIFF3WAV10PropertiesE() {
        return wasmImports._ZTIN6TagLib4RIFF3WAV10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib4RIFF3WAV10PropertiesE.stub = !0;
      function __ZTIN6TagLib4RIFF3WAV4FileE() {
        return wasmImports._ZTIN6TagLib4RIFF3WAV4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib4RIFF3WAV4FileE.stub = !0;
      function __ZTIN6TagLib4RIFF4AIFF10PropertiesE() {
        return wasmImports._ZTIN6TagLib4RIFF4AIFF10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib4RIFF4AIFF10PropertiesE.stub = !0;
      function __ZTIN6TagLib4RIFF4AIFF4FileE() {
        return wasmImports._ZTIN6TagLib4RIFF4AIFF4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib4RIFF4AIFF4FileE.stub = !0;
      function __ZTIN6TagLib4RIFF4FileE() {
        return wasmImports._ZTIN6TagLib4RIFF4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib4RIFF4FileE.stub = !0;
      function __ZTIN6TagLib4RIFF4Info13StringHandlerE() {
        return wasmImports._ZTIN6TagLib4RIFF4Info13StringHandlerE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib4RIFF4Info13StringHandlerE.stub = !0;
      function __ZTIN6TagLib4RIFF4Info3TagE() {
        return wasmImports._ZTIN6TagLib4RIFF4Info3TagE.apply(null, arguments);
      }
      __ZTIN6TagLib4RIFF4Info3TagE.stub = !0;
      function __ZTIN6TagLib5ID3v113StringHandlerE() {
        return wasmImports._ZTIN6TagLib5ID3v113StringHandlerE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v113StringHandlerE.stub = !0;
      function __ZTIN6TagLib5ID3v13TagE() {
        return wasmImports._ZTIN6TagLib5ID3v13TagE.apply(null, arguments);
      }
      __ZTIN6TagLib5ID3v13TagE.stub = !0;
      function __ZTIN6TagLib5ID3v212ChapterFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v212ChapterFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v212ChapterFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v212FrameFactoryE() {
        return wasmImports._ZTIN6TagLib5ID3v212FrameFactoryE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v212FrameFactoryE.stub = !0;
      function __ZTIN6TagLib5ID3v212PodcastFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v212PodcastFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v212PodcastFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v212PrivateFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v212PrivateFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v212PrivateFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v212UnknownFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v212UnknownFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v212UnknownFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v212UrlLinkFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v212UrlLinkFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v212UrlLinkFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v213CommentsFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v213CommentsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v213CommentsFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v214ExtendedHeaderE() {
        return wasmImports._ZTIN6TagLib5ID3v214ExtendedHeaderE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v214ExtendedHeaderE.stub = !0;
      function __ZTIN6TagLib5ID3v214OwnershipFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v214OwnershipFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v214OwnershipFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v216UserUrlLinkFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v216UserUrlLinkFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v216UserUrlLinkFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v218PopularimeterFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v218PopularimeterFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v218PopularimeterFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v219Latin1StringHandlerE() {
        return wasmImports._ZTIN6TagLib5ID3v219Latin1StringHandlerE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v219Latin1StringHandlerE.stub = !0;
      function __ZTIN6TagLib5ID3v219RelativeVolumeFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v219RelativeVolumeFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v219RelativeVolumeFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v220AttachedPictureFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v220AttachedPictureFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v220AttachedPictureFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v220TableOfContentsFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v220TableOfContentsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v220TableOfContentsFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v221EventTimingCodesFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v221EventTimingCodesFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v221EventTimingCodesFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v223AttachedPictureFrameV22E() {
        return wasmImports._ZTIN6TagLib5ID3v223AttachedPictureFrameV22E.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v223AttachedPictureFrameV22E.stub = !0;
      function __ZTIN6TagLib5ID3v223SynchronizedLyricsFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v223SynchronizedLyricsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v223SynchronizedLyricsFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v223TextIdentificationFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v223TextIdentificationFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v223TextIdentificationFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v225UniqueFileIdentifierFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v225UniqueFileIdentifierFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v225UniqueFileIdentifierFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v225UnsynchronizedLyricsFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v225UnsynchronizedLyricsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v225UnsynchronizedLyricsFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v227UserTextIdentificationFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v227UserTextIdentificationFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v227UserTextIdentificationFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE() {
        return wasmImports._ZTIN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE.stub = !0;
      function __ZTIN6TagLib5ID3v23TagE() {
        return wasmImports._ZTIN6TagLib5ID3v23TagE.apply(null, arguments);
      }
      __ZTIN6TagLib5ID3v23TagE.stub = !0;
      function __ZTIN6TagLib5ID3v25Frame6HeaderE() {
        return wasmImports._ZTIN6TagLib5ID3v25Frame6HeaderE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib5ID3v25Frame6HeaderE.stub = !0;
      function __ZTIN6TagLib5ID3v25FrameE() {
        return wasmImports._ZTIN6TagLib5ID3v25FrameE.apply(null, arguments);
      }
      __ZTIN6TagLib5ID3v25FrameE.stub = !0;
      function __ZTIN6TagLib5ID3v26FooterE() {
        return wasmImports._ZTIN6TagLib5ID3v26FooterE.apply(null, arguments);
      }
      __ZTIN6TagLib5ID3v26FooterE.stub = !0;
      function __ZTIN6TagLib5ID3v26HeaderE() {
        return wasmImports._ZTIN6TagLib5ID3v26HeaderE.apply(null, arguments);
      }
      __ZTIN6TagLib5ID3v26HeaderE.stub = !0;
      function __ZTIN6TagLib6DSDIFF10PropertiesE() {
        return wasmImports._ZTIN6TagLib6DSDIFF10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib6DSDIFF10PropertiesE.stub = !0;
      function __ZTIN6TagLib6DSDIFF4DIIN3TagE() {
        return wasmImports._ZTIN6TagLib6DSDIFF4DIIN3TagE.apply(null, arguments);
      }
      __ZTIN6TagLib6DSDIFF4DIIN3TagE.stub = !0;
      function __ZTIN6TagLib6DSDIFF4FileE() {
        return wasmImports._ZTIN6TagLib6DSDIFF4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib6DSDIFF4FileE.stub = !0;
      function __ZTIN6TagLib6Vorbis10PropertiesE() {
        return wasmImports._ZTIN6TagLib6Vorbis10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib6Vorbis10PropertiesE.stub = !0;
      function __ZTIN6TagLib6Vorbis4FileE() {
        return wasmImports._ZTIN6TagLib6Vorbis4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib6Vorbis4FileE.stub = !0;
      function __ZTIN6TagLib7FileRef16FileTypeResolverE() {
        return wasmImports._ZTIN6TagLib7FileRef16FileTypeResolverE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib7FileRef16FileTypeResolverE.stub = !0;
      function __ZTIN6TagLib7FileRef18StreamTypeResolverE() {
        return wasmImports._ZTIN6TagLib7FileRef18StreamTypeResolverE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib7FileRef18StreamTypeResolverE.stub = !0;
      function __ZTIN6TagLib7WavPack10PropertiesE() {
        return wasmImports._ZTIN6TagLib7WavPack10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib7WavPack10PropertiesE.stub = !0;
      function __ZTIN6TagLib7WavPack4FileE() {
        return wasmImports._ZTIN6TagLib7WavPack4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib7WavPack4FileE.stub = !0;
      function __ZTIN6TagLib8IOStreamE() {
        return wasmImports._ZTIN6TagLib8IOStreamE.apply(null, arguments);
      }
      __ZTIN6TagLib8IOStreamE.stub = !0;
      function __ZTIN6TagLib8TagUnionE() {
        return wasmImports._ZTIN6TagLib8TagUnionE.apply(null, arguments);
      }
      __ZTIN6TagLib8TagUnionE.stub = !0;
      function __ZTIN6TagLib9TrueAudio10PropertiesE() {
        return wasmImports._ZTIN6TagLib9TrueAudio10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTIN6TagLib9TrueAudio10PropertiesE.stub = !0;
      function __ZTIN6TagLib9TrueAudio4FileE() {
        return wasmImports._ZTIN6TagLib9TrueAudio4FileE.apply(null, arguments);
      }
      __ZTIN6TagLib9TrueAudio4FileE.stub = !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE.stub =
        !0;
      function __ZTINSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE() {
        return wasmImports._ZTINSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTINSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE.stub =
        !0;
      function __ZTSN4utf812invalid_utf8E() {
        return wasmImports._ZTSN4utf812invalid_utf8E.apply(null, arguments);
      }
      __ZTSN4utf812invalid_utf8E.stub = !0;
      function __ZTSN4utf813invalid_utf16E() {
        return wasmImports._ZTSN4utf813invalid_utf16E.apply(null, arguments);
      }
      __ZTSN4utf813invalid_utf16E.stub = !0;
      function __ZTSN4utf815not_enough_roomE() {
        return wasmImports._ZTSN4utf815not_enough_roomE.apply(null, arguments);
      }
      __ZTSN4utf815not_enough_roomE.stub = !0;
      function __ZTSN4utf818invalid_code_pointE() {
        return wasmImports._ZTSN4utf818invalid_code_pointE.apply(
          null,
          arguments
        );
      }
      __ZTSN4utf818invalid_code_pointE.stub = !0;
      function __ZTSN4utf89exceptionE() {
        return wasmImports._ZTSN4utf89exceptionE.apply(null, arguments);
      }
      __ZTSN4utf89exceptionE.stub = !0;
      function __ZTSN6TagLib10FileStreamE() {
        return wasmImports._ZTSN6TagLib10FileStreamE.apply(null, arguments);
      }
      __ZTSN6TagLib10FileStreamE.stub = !0;
      function __ZTSN6TagLib13DebugListenerE() {
        return wasmImports._ZTSN6TagLib13DebugListenerE.apply(null, arguments);
      }
      __ZTSN6TagLib13DebugListenerE.stub = !0;
      function __ZTSN6TagLib15AudioPropertiesE() {
        return wasmImports._ZTSN6TagLib15AudioPropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib15AudioPropertiesE.stub = !0;
      function __ZTSN6TagLib16ByteVectorStreamE() {
        return wasmImports._ZTSN6TagLib16ByteVectorStreamE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib16ByteVectorStreamE.stub = !0;
      function __ZTSN6TagLib2IT10PropertiesE() {
        return wasmImports._ZTSN6TagLib2IT10PropertiesE.apply(null, arguments);
      }
      __ZTSN6TagLib2IT10PropertiesE.stub = !0;
      function __ZTSN6TagLib2IT4FileE() {
        return wasmImports._ZTSN6TagLib2IT4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib2IT4FileE.stub = !0;
      function __ZTSN6TagLib2XM10PropertiesE() {
        return wasmImports._ZTSN6TagLib2XM10PropertiesE.apply(null, arguments);
      }
      __ZTSN6TagLib2XM10PropertiesE.stub = !0;
      function __ZTSN6TagLib2XM4FileE() {
        return wasmImports._ZTSN6TagLib2XM4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib2XM4FileE.stub = !0;
      function __ZTSN6TagLib3APE10PropertiesE() {
        return wasmImports._ZTSN6TagLib3APE10PropertiesE.apply(null, arguments);
      }
      __ZTSN6TagLib3APE10PropertiesE.stub = !0;
      function __ZTSN6TagLib3APE3TagE() {
        return wasmImports._ZTSN6TagLib3APE3TagE.apply(null, arguments);
      }
      __ZTSN6TagLib3APE3TagE.stub = !0;
      function __ZTSN6TagLib3APE4FileE() {
        return wasmImports._ZTSN6TagLib3APE4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3APE4FileE.stub = !0;
      function __ZTSN6TagLib3APE4ItemE() {
        return wasmImports._ZTSN6TagLib3APE4ItemE.apply(null, arguments);
      }
      __ZTSN6TagLib3APE4ItemE.stub = !0;
      function __ZTSN6TagLib3APE6FooterE() {
        return wasmImports._ZTSN6TagLib3APE6FooterE.apply(null, arguments);
      }
      __ZTSN6TagLib3APE6FooterE.stub = !0;
      function __ZTSN6TagLib3ASF10PropertiesE() {
        return wasmImports._ZTSN6TagLib3ASF10PropertiesE.apply(null, arguments);
      }
      __ZTSN6TagLib3ASF10PropertiesE.stub = !0;
      function __ZTSN6TagLib3ASF3TagE() {
        return wasmImports._ZTSN6TagLib3ASF3TagE.apply(null, arguments);
      }
      __ZTSN6TagLib3ASF3TagE.stub = !0;
      function __ZTSN6TagLib3ASF4File11FilePrivate10BaseObjectE() {
        return wasmImports._ZTSN6TagLib3ASF4File11FilePrivate10BaseObjectE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3ASF4File11FilePrivate10BaseObjectE.stub = !0;
      function __ZTSN6TagLib3ASF4File11FilePrivate13UnknownObjectE() {
        return wasmImports._ZTSN6TagLib3ASF4File11FilePrivate13UnknownObjectE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3ASF4File11FilePrivate13UnknownObjectE.stub = !0;
      function __ZTSN6TagLib3ASF4File11FilePrivate14MetadataObjectE() {
        return wasmImports._ZTSN6TagLib3ASF4File11FilePrivate14MetadataObjectE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3ASF4File11FilePrivate14MetadataObjectE.stub = !0;
      function __ZTSN6TagLib3ASF4File11FilePrivate15CodecListObjectE() {
        return wasmImports._ZTSN6TagLib3ASF4File11FilePrivate15CodecListObjectE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3ASF4File11FilePrivate15CodecListObjectE.stub = !0;
      function __ZTSN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE() {
        return wasmImports._ZTSN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE.stub = !0;
      function __ZTSN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE() {
        return wasmImports._ZTSN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE.stub = !0;
      function __ZTSN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE() {
        return wasmImports._ZTSN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE.stub = !0;
      function __ZTSN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE() {
        return wasmImports._ZTSN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE.stub = !0;
      function __ZTSN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE() {
        return wasmImports._ZTSN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE.stub = !0;
      function __ZTSN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE() {
        return wasmImports._ZTSN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE.stub =
        !0;
      function __ZTSN6TagLib3ASF4FileE() {
        return wasmImports._ZTSN6TagLib3ASF4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3ASF4FileE.stub = !0;
      function __ZTSN6TagLib3ASF7PictureE() {
        return wasmImports._ZTSN6TagLib3ASF7PictureE.apply(null, arguments);
      }
      __ZTSN6TagLib3ASF7PictureE.stub = !0;
      function __ZTSN6TagLib3ASF9AttributeE() {
        return wasmImports._ZTSN6TagLib3ASF9AttributeE.apply(null, arguments);
      }
      __ZTSN6TagLib3ASF9AttributeE.stub = !0;
      function __ZTSN6TagLib3DSF10PropertiesE() {
        return wasmImports._ZTSN6TagLib3DSF10PropertiesE.apply(null, arguments);
      }
      __ZTSN6TagLib3DSF10PropertiesE.stub = !0;
      function __ZTSN6TagLib3DSF4FileE() {
        return wasmImports._ZTSN6TagLib3DSF4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3DSF4FileE.stub = !0;
      function __ZTSN6TagLib3MP410PropertiesE() {
        return wasmImports._ZTSN6TagLib3MP410PropertiesE.apply(null, arguments);
      }
      __ZTSN6TagLib3MP410PropertiesE.stub = !0;
      function __ZTSN6TagLib3MP411ItemFactoryE() {
        return wasmImports._ZTSN6TagLib3MP411ItemFactoryE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3MP411ItemFactoryE.stub = !0;
      function __ZTSN6TagLib3MP43TagE() {
        return wasmImports._ZTSN6TagLib3MP43TagE.apply(null, arguments);
      }
      __ZTSN6TagLib3MP43TagE.stub = !0;
      function __ZTSN6TagLib3MP44FileE() {
        return wasmImports._ZTSN6TagLib3MP44FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3MP44FileE.stub = !0;
      function __ZTSN6TagLib3MP44ItemE() {
        return wasmImports._ZTSN6TagLib3MP44ItemE.apply(null, arguments);
      }
      __ZTSN6TagLib3MP44ItemE.stub = !0;
      function __ZTSN6TagLib3MP48CoverArtE() {
        return wasmImports._ZTSN6TagLib3MP48CoverArtE.apply(null, arguments);
      }
      __ZTSN6TagLib3MP48CoverArtE.stub = !0;
      function __ZTSN6TagLib3MPC10PropertiesE() {
        return wasmImports._ZTSN6TagLib3MPC10PropertiesE.apply(null, arguments);
      }
      __ZTSN6TagLib3MPC10PropertiesE.stub = !0;
      function __ZTSN6TagLib3MPC4FileE() {
        return wasmImports._ZTSN6TagLib3MPC4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3MPC4FileE.stub = !0;
      function __ZTSN6TagLib3Mod10PropertiesE() {
        return wasmImports._ZTSN6TagLib3Mod10PropertiesE.apply(null, arguments);
      }
      __ZTSN6TagLib3Mod10PropertiesE.stub = !0;
      function __ZTSN6TagLib3Mod3TagE() {
        return wasmImports._ZTSN6TagLib3Mod3TagE.apply(null, arguments);
      }
      __ZTSN6TagLib3Mod3TagE.stub = !0;
      function __ZTSN6TagLib3Mod4FileE() {
        return wasmImports._ZTSN6TagLib3Mod4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3Mod4FileE.stub = !0;
      function __ZTSN6TagLib3Mod8FileBaseE() {
        return wasmImports._ZTSN6TagLib3Mod8FileBaseE.apply(null, arguments);
      }
      __ZTSN6TagLib3Mod8FileBaseE.stub = !0;
      function __ZTSN6TagLib3Ogg10PageHeaderE() {
        return wasmImports._ZTSN6TagLib3Ogg10PageHeaderE.apply(null, arguments);
      }
      __ZTSN6TagLib3Ogg10PageHeaderE.stub = !0;
      function __ZTSN6TagLib3Ogg11XiphCommentE() {
        return wasmImports._ZTSN6TagLib3Ogg11XiphCommentE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3Ogg11XiphCommentE.stub = !0;
      function __ZTSN6TagLib3Ogg4FLAC4FileE() {
        return wasmImports._ZTSN6TagLib3Ogg4FLAC4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3Ogg4FLAC4FileE.stub = !0;
      function __ZTSN6TagLib3Ogg4FileE() {
        return wasmImports._ZTSN6TagLib3Ogg4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3Ogg4FileE.stub = !0;
      function __ZTSN6TagLib3Ogg4Opus10PropertiesE() {
        return wasmImports._ZTSN6TagLib3Ogg4Opus10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3Ogg4Opus10PropertiesE.stub = !0;
      function __ZTSN6TagLib3Ogg4Opus4FileE() {
        return wasmImports._ZTSN6TagLib3Ogg4Opus4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3Ogg4Opus4FileE.stub = !0;
      function __ZTSN6TagLib3Ogg4PageE() {
        return wasmImports._ZTSN6TagLib3Ogg4PageE.apply(null, arguments);
      }
      __ZTSN6TagLib3Ogg4PageE.stub = !0;
      function __ZTSN6TagLib3Ogg5Speex10PropertiesE() {
        return wasmImports._ZTSN6TagLib3Ogg5Speex10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib3Ogg5Speex10PropertiesE.stub = !0;
      function __ZTSN6TagLib3Ogg5Speex4FileE() {
        return wasmImports._ZTSN6TagLib3Ogg5Speex4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3Ogg5Speex4FileE.stub = !0;
      function __ZTSN6TagLib3S3M10PropertiesE() {
        return wasmImports._ZTSN6TagLib3S3M10PropertiesE.apply(null, arguments);
      }
      __ZTSN6TagLib3S3M10PropertiesE.stub = !0;
      function __ZTSN6TagLib3S3M4FileE() {
        return wasmImports._ZTSN6TagLib3S3M4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib3S3M4FileE.stub = !0;
      function __ZTSN6TagLib3TagE() {
        return wasmImports._ZTSN6TagLib3TagE.apply(null, arguments);
      }
      __ZTSN6TagLib3TagE.stub = !0;
      function __ZTSN6TagLib4FLAC10PropertiesE() {
        return wasmImports._ZTSN6TagLib4FLAC10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib4FLAC10PropertiesE.stub = !0;
      function __ZTSN6TagLib4FLAC13MetadataBlockE() {
        return wasmImports._ZTSN6TagLib4FLAC13MetadataBlockE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib4FLAC13MetadataBlockE.stub = !0;
      function __ZTSN6TagLib4FLAC20UnknownMetadataBlockE() {
        return wasmImports._ZTSN6TagLib4FLAC20UnknownMetadataBlockE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib4FLAC20UnknownMetadataBlockE.stub = !0;
      function __ZTSN6TagLib4FLAC4FileE() {
        return wasmImports._ZTSN6TagLib4FLAC4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib4FLAC4FileE.stub = !0;
      function __ZTSN6TagLib4FLAC7PictureE() {
        return wasmImports._ZTSN6TagLib4FLAC7PictureE.apply(null, arguments);
      }
      __ZTSN6TagLib4FLAC7PictureE.stub = !0;
      function __ZTSN6TagLib4FileE() {
        return wasmImports._ZTSN6TagLib4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib4FileE.stub = !0;
      function __ZTSN6TagLib4MPEG10PropertiesE() {
        return wasmImports._ZTSN6TagLib4MPEG10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib4MPEG10PropertiesE.stub = !0;
      function __ZTSN6TagLib4MPEG10XingHeaderE() {
        return wasmImports._ZTSN6TagLib4MPEG10XingHeaderE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib4MPEG10XingHeaderE.stub = !0;
      function __ZTSN6TagLib4MPEG4FileE() {
        return wasmImports._ZTSN6TagLib4MPEG4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib4MPEG4FileE.stub = !0;
      function __ZTSN6TagLib4MPEG6HeaderE() {
        return wasmImports._ZTSN6TagLib4MPEG6HeaderE.apply(null, arguments);
      }
      __ZTSN6TagLib4MPEG6HeaderE.stub = !0;
      function __ZTSN6TagLib4RIFF3WAV10PropertiesE() {
        return wasmImports._ZTSN6TagLib4RIFF3WAV10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib4RIFF3WAV10PropertiesE.stub = !0;
      function __ZTSN6TagLib4RIFF3WAV4FileE() {
        return wasmImports._ZTSN6TagLib4RIFF3WAV4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib4RIFF3WAV4FileE.stub = !0;
      function __ZTSN6TagLib4RIFF4AIFF10PropertiesE() {
        return wasmImports._ZTSN6TagLib4RIFF4AIFF10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib4RIFF4AIFF10PropertiesE.stub = !0;
      function __ZTSN6TagLib4RIFF4AIFF4FileE() {
        return wasmImports._ZTSN6TagLib4RIFF4AIFF4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib4RIFF4AIFF4FileE.stub = !0;
      function __ZTSN6TagLib4RIFF4FileE() {
        return wasmImports._ZTSN6TagLib4RIFF4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib4RIFF4FileE.stub = !0;
      function __ZTSN6TagLib4RIFF4Info13StringHandlerE() {
        return wasmImports._ZTSN6TagLib4RIFF4Info13StringHandlerE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib4RIFF4Info13StringHandlerE.stub = !0;
      function __ZTSN6TagLib4RIFF4Info3TagE() {
        return wasmImports._ZTSN6TagLib4RIFF4Info3TagE.apply(null, arguments);
      }
      __ZTSN6TagLib4RIFF4Info3TagE.stub = !0;
      function __ZTSN6TagLib5ID3v113StringHandlerE() {
        return wasmImports._ZTSN6TagLib5ID3v113StringHandlerE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v113StringHandlerE.stub = !0;
      function __ZTSN6TagLib5ID3v13TagE() {
        return wasmImports._ZTSN6TagLib5ID3v13TagE.apply(null, arguments);
      }
      __ZTSN6TagLib5ID3v13TagE.stub = !0;
      function __ZTSN6TagLib5ID3v212ChapterFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v212ChapterFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v212ChapterFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v212FrameFactoryE() {
        return wasmImports._ZTSN6TagLib5ID3v212FrameFactoryE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v212FrameFactoryE.stub = !0;
      function __ZTSN6TagLib5ID3v212PodcastFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v212PodcastFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v212PodcastFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v212PrivateFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v212PrivateFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v212PrivateFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v212UnknownFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v212UnknownFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v212UnknownFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v212UrlLinkFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v212UrlLinkFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v212UrlLinkFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v213CommentsFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v213CommentsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v213CommentsFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v214ExtendedHeaderE() {
        return wasmImports._ZTSN6TagLib5ID3v214ExtendedHeaderE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v214ExtendedHeaderE.stub = !0;
      function __ZTSN6TagLib5ID3v214OwnershipFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v214OwnershipFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v214OwnershipFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v216UserUrlLinkFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v216UserUrlLinkFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v216UserUrlLinkFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v218PopularimeterFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v218PopularimeterFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v218PopularimeterFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v219Latin1StringHandlerE() {
        return wasmImports._ZTSN6TagLib5ID3v219Latin1StringHandlerE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v219Latin1StringHandlerE.stub = !0;
      function __ZTSN6TagLib5ID3v219RelativeVolumeFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v219RelativeVolumeFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v219RelativeVolumeFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v220AttachedPictureFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v220AttachedPictureFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v220AttachedPictureFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v220TableOfContentsFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v220TableOfContentsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v220TableOfContentsFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v221EventTimingCodesFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v221EventTimingCodesFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v221EventTimingCodesFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v223AttachedPictureFrameV22E() {
        return wasmImports._ZTSN6TagLib5ID3v223AttachedPictureFrameV22E.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v223AttachedPictureFrameV22E.stub = !0;
      function __ZTSN6TagLib5ID3v223SynchronizedLyricsFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v223SynchronizedLyricsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v223SynchronizedLyricsFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v223TextIdentificationFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v223TextIdentificationFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v223TextIdentificationFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v225UniqueFileIdentifierFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v225UniqueFileIdentifierFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v225UniqueFileIdentifierFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v225UnsynchronizedLyricsFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v225UnsynchronizedLyricsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v225UnsynchronizedLyricsFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v227UserTextIdentificationFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v227UserTextIdentificationFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v227UserTextIdentificationFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE() {
        return wasmImports._ZTSN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE.stub = !0;
      function __ZTSN6TagLib5ID3v23TagE() {
        return wasmImports._ZTSN6TagLib5ID3v23TagE.apply(null, arguments);
      }
      __ZTSN6TagLib5ID3v23TagE.stub = !0;
      function __ZTSN6TagLib5ID3v25Frame6HeaderE() {
        return wasmImports._ZTSN6TagLib5ID3v25Frame6HeaderE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib5ID3v25Frame6HeaderE.stub = !0;
      function __ZTSN6TagLib5ID3v25FrameE() {
        return wasmImports._ZTSN6TagLib5ID3v25FrameE.apply(null, arguments);
      }
      __ZTSN6TagLib5ID3v25FrameE.stub = !0;
      function __ZTSN6TagLib5ID3v26FooterE() {
        return wasmImports._ZTSN6TagLib5ID3v26FooterE.apply(null, arguments);
      }
      __ZTSN6TagLib5ID3v26FooterE.stub = !0;
      function __ZTSN6TagLib5ID3v26HeaderE() {
        return wasmImports._ZTSN6TagLib5ID3v26HeaderE.apply(null, arguments);
      }
      __ZTSN6TagLib5ID3v26HeaderE.stub = !0;
      function __ZTSN6TagLib6DSDIFF10PropertiesE() {
        return wasmImports._ZTSN6TagLib6DSDIFF10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib6DSDIFF10PropertiesE.stub = !0;
      function __ZTSN6TagLib6DSDIFF4DIIN3TagE() {
        return wasmImports._ZTSN6TagLib6DSDIFF4DIIN3TagE.apply(null, arguments);
      }
      __ZTSN6TagLib6DSDIFF4DIIN3TagE.stub = !0;
      function __ZTSN6TagLib6DSDIFF4FileE() {
        return wasmImports._ZTSN6TagLib6DSDIFF4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib6DSDIFF4FileE.stub = !0;
      function __ZTSN6TagLib6Vorbis10PropertiesE() {
        return wasmImports._ZTSN6TagLib6Vorbis10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib6Vorbis10PropertiesE.stub = !0;
      function __ZTSN6TagLib6Vorbis4FileE() {
        return wasmImports._ZTSN6TagLib6Vorbis4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib6Vorbis4FileE.stub = !0;
      function __ZTSN6TagLib7FileRef16FileTypeResolverE() {
        return wasmImports._ZTSN6TagLib7FileRef16FileTypeResolverE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib7FileRef16FileTypeResolverE.stub = !0;
      function __ZTSN6TagLib7FileRef18StreamTypeResolverE() {
        return wasmImports._ZTSN6TagLib7FileRef18StreamTypeResolverE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib7FileRef18StreamTypeResolverE.stub = !0;
      function __ZTSN6TagLib7WavPack10PropertiesE() {
        return wasmImports._ZTSN6TagLib7WavPack10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib7WavPack10PropertiesE.stub = !0;
      function __ZTSN6TagLib7WavPack4FileE() {
        return wasmImports._ZTSN6TagLib7WavPack4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib7WavPack4FileE.stub = !0;
      function __ZTSN6TagLib8IOStreamE() {
        return wasmImports._ZTSN6TagLib8IOStreamE.apply(null, arguments);
      }
      __ZTSN6TagLib8IOStreamE.stub = !0;
      function __ZTSN6TagLib8TagUnionE() {
        return wasmImports._ZTSN6TagLib8TagUnionE.apply(null, arguments);
      }
      __ZTSN6TagLib8TagUnionE.stub = !0;
      function __ZTSN6TagLib9TrueAudio10PropertiesE() {
        return wasmImports._ZTSN6TagLib9TrueAudio10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTSN6TagLib9TrueAudio10PropertiesE.stub = !0;
      function __ZTSN6TagLib9TrueAudio4FileE() {
        return wasmImports._ZTSN6TagLib9TrueAudio4FileE.apply(null, arguments);
      }
      __ZTSN6TagLib9TrueAudio4FileE.stub = !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE.stub =
        !0;
      function __ZTSNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE() {
        return wasmImports._ZTSNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTSNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE.stub =
        !0;
      function __ZTVN4utf812invalid_utf8E() {
        return wasmImports._ZTVN4utf812invalid_utf8E.apply(null, arguments);
      }
      __ZTVN4utf812invalid_utf8E.stub = !0;
      function __ZTVN4utf813invalid_utf16E() {
        return wasmImports._ZTVN4utf813invalid_utf16E.apply(null, arguments);
      }
      __ZTVN4utf813invalid_utf16E.stub = !0;
      function __ZTVN4utf815not_enough_roomE() {
        return wasmImports._ZTVN4utf815not_enough_roomE.apply(null, arguments);
      }
      __ZTVN4utf815not_enough_roomE.stub = !0;
      function __ZTVN4utf818invalid_code_pointE() {
        return wasmImports._ZTVN4utf818invalid_code_pointE.apply(
          null,
          arguments
        );
      }
      __ZTVN4utf818invalid_code_pointE.stub = !0;
      function __ZTVN6TagLib10FileStreamE() {
        return wasmImports._ZTVN6TagLib10FileStreamE.apply(null, arguments);
      }
      __ZTVN6TagLib10FileStreamE.stub = !0;
      function __ZTVN6TagLib13DebugListenerE() {
        return wasmImports._ZTVN6TagLib13DebugListenerE.apply(null, arguments);
      }
      __ZTVN6TagLib13DebugListenerE.stub = !0;
      function __ZTVN6TagLib15AudioPropertiesE() {
        return wasmImports._ZTVN6TagLib15AudioPropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib15AudioPropertiesE.stub = !0;
      function __ZTVN6TagLib16ByteVectorStreamE() {
        return wasmImports._ZTVN6TagLib16ByteVectorStreamE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib16ByteVectorStreamE.stub = !0;
      function __ZTVN6TagLib2IT10PropertiesE() {
        return wasmImports._ZTVN6TagLib2IT10PropertiesE.apply(null, arguments);
      }
      __ZTVN6TagLib2IT10PropertiesE.stub = !0;
      function __ZTVN6TagLib2IT4FileE() {
        return wasmImports._ZTVN6TagLib2IT4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib2IT4FileE.stub = !0;
      function __ZTVN6TagLib2XM10PropertiesE() {
        return wasmImports._ZTVN6TagLib2XM10PropertiesE.apply(null, arguments);
      }
      __ZTVN6TagLib2XM10PropertiesE.stub = !0;
      function __ZTVN6TagLib2XM4FileE() {
        return wasmImports._ZTVN6TagLib2XM4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib2XM4FileE.stub = !0;
      function __ZTVN6TagLib3APE10PropertiesE() {
        return wasmImports._ZTVN6TagLib3APE10PropertiesE.apply(null, arguments);
      }
      __ZTVN6TagLib3APE10PropertiesE.stub = !0;
      function __ZTVN6TagLib3APE3TagE() {
        return wasmImports._ZTVN6TagLib3APE3TagE.apply(null, arguments);
      }
      __ZTVN6TagLib3APE3TagE.stub = !0;
      function __ZTVN6TagLib3APE4FileE() {
        return wasmImports._ZTVN6TagLib3APE4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3APE4FileE.stub = !0;
      function __ZTVN6TagLib3APE4ItemE() {
        return wasmImports._ZTVN6TagLib3APE4ItemE.apply(null, arguments);
      }
      __ZTVN6TagLib3APE4ItemE.stub = !0;
      function __ZTVN6TagLib3APE6FooterE() {
        return wasmImports._ZTVN6TagLib3APE6FooterE.apply(null, arguments);
      }
      __ZTVN6TagLib3APE6FooterE.stub = !0;
      function __ZTVN6TagLib3ASF10PropertiesE() {
        return wasmImports._ZTVN6TagLib3ASF10PropertiesE.apply(null, arguments);
      }
      __ZTVN6TagLib3ASF10PropertiesE.stub = !0;
      function __ZTVN6TagLib3ASF3TagE() {
        return wasmImports._ZTVN6TagLib3ASF3TagE.apply(null, arguments);
      }
      __ZTVN6TagLib3ASF3TagE.stub = !0;
      function __ZTVN6TagLib3ASF4File11FilePrivate10BaseObjectE() {
        return wasmImports._ZTVN6TagLib3ASF4File11FilePrivate10BaseObjectE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3ASF4File11FilePrivate10BaseObjectE.stub = !0;
      function __ZTVN6TagLib3ASF4File11FilePrivate13UnknownObjectE() {
        return wasmImports._ZTVN6TagLib3ASF4File11FilePrivate13UnknownObjectE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3ASF4File11FilePrivate13UnknownObjectE.stub = !0;
      function __ZTVN6TagLib3ASF4File11FilePrivate14MetadataObjectE() {
        return wasmImports._ZTVN6TagLib3ASF4File11FilePrivate14MetadataObjectE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3ASF4File11FilePrivate14MetadataObjectE.stub = !0;
      function __ZTVN6TagLib3ASF4File11FilePrivate15CodecListObjectE() {
        return wasmImports._ZTVN6TagLib3ASF4File11FilePrivate15CodecListObjectE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3ASF4File11FilePrivate15CodecListObjectE.stub = !0;
      function __ZTVN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE() {
        return wasmImports._ZTVN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE.stub = !0;
      function __ZTVN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE() {
        return wasmImports._ZTVN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE.stub = !0;
      function __ZTVN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE() {
        return wasmImports._ZTVN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE.stub = !0;
      function __ZTVN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE() {
        return wasmImports._ZTVN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE.stub = !0;
      function __ZTVN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE() {
        return wasmImports._ZTVN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE.stub = !0;
      function __ZTVN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE() {
        return wasmImports._ZTVN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE.stub =
        !0;
      function __ZTVN6TagLib3ASF4FileE() {
        return wasmImports._ZTVN6TagLib3ASF4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3ASF4FileE.stub = !0;
      function __ZTVN6TagLib3ASF7PictureE() {
        return wasmImports._ZTVN6TagLib3ASF7PictureE.apply(null, arguments);
      }
      __ZTVN6TagLib3ASF7PictureE.stub = !0;
      function __ZTVN6TagLib3ASF9AttributeE() {
        return wasmImports._ZTVN6TagLib3ASF9AttributeE.apply(null, arguments);
      }
      __ZTVN6TagLib3ASF9AttributeE.stub = !0;
      function __ZTVN6TagLib3DSF10PropertiesE() {
        return wasmImports._ZTVN6TagLib3DSF10PropertiesE.apply(null, arguments);
      }
      __ZTVN6TagLib3DSF10PropertiesE.stub = !0;
      function __ZTVN6TagLib3DSF4FileE() {
        return wasmImports._ZTVN6TagLib3DSF4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3DSF4FileE.stub = !0;
      function __ZTVN6TagLib3MP410PropertiesE() {
        return wasmImports._ZTVN6TagLib3MP410PropertiesE.apply(null, arguments);
      }
      __ZTVN6TagLib3MP410PropertiesE.stub = !0;
      function __ZTVN6TagLib3MP411ItemFactoryE() {
        return wasmImports._ZTVN6TagLib3MP411ItemFactoryE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3MP411ItemFactoryE.stub = !0;
      function __ZTVN6TagLib3MP43TagE() {
        return wasmImports._ZTVN6TagLib3MP43TagE.apply(null, arguments);
      }
      __ZTVN6TagLib3MP43TagE.stub = !0;
      function __ZTVN6TagLib3MP44FileE() {
        return wasmImports._ZTVN6TagLib3MP44FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3MP44FileE.stub = !0;
      function __ZTVN6TagLib3MP44ItemE() {
        return wasmImports._ZTVN6TagLib3MP44ItemE.apply(null, arguments);
      }
      __ZTVN6TagLib3MP44ItemE.stub = !0;
      function __ZTVN6TagLib3MP48CoverArtE() {
        return wasmImports._ZTVN6TagLib3MP48CoverArtE.apply(null, arguments);
      }
      __ZTVN6TagLib3MP48CoverArtE.stub = !0;
      function __ZTVN6TagLib3MPC10PropertiesE() {
        return wasmImports._ZTVN6TagLib3MPC10PropertiesE.apply(null, arguments);
      }
      __ZTVN6TagLib3MPC10PropertiesE.stub = !0;
      function __ZTVN6TagLib3MPC4FileE() {
        return wasmImports._ZTVN6TagLib3MPC4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3MPC4FileE.stub = !0;
      function __ZTVN6TagLib3Mod10PropertiesE() {
        return wasmImports._ZTVN6TagLib3Mod10PropertiesE.apply(null, arguments);
      }
      __ZTVN6TagLib3Mod10PropertiesE.stub = !0;
      function __ZTVN6TagLib3Mod3TagE() {
        return wasmImports._ZTVN6TagLib3Mod3TagE.apply(null, arguments);
      }
      __ZTVN6TagLib3Mod3TagE.stub = !0;
      function __ZTVN6TagLib3Mod4FileE() {
        return wasmImports._ZTVN6TagLib3Mod4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3Mod4FileE.stub = !0;
      function __ZTVN6TagLib3Mod8FileBaseE() {
        return wasmImports._ZTVN6TagLib3Mod8FileBaseE.apply(null, arguments);
      }
      __ZTVN6TagLib3Mod8FileBaseE.stub = !0;
      function __ZTVN6TagLib3Ogg10PageHeaderE() {
        return wasmImports._ZTVN6TagLib3Ogg10PageHeaderE.apply(null, arguments);
      }
      __ZTVN6TagLib3Ogg10PageHeaderE.stub = !0;
      function __ZTVN6TagLib3Ogg11XiphCommentE() {
        return wasmImports._ZTVN6TagLib3Ogg11XiphCommentE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3Ogg11XiphCommentE.stub = !0;
      function __ZTVN6TagLib3Ogg4FLAC4FileE() {
        return wasmImports._ZTVN6TagLib3Ogg4FLAC4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3Ogg4FLAC4FileE.stub = !0;
      function __ZTVN6TagLib3Ogg4FileE() {
        return wasmImports._ZTVN6TagLib3Ogg4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3Ogg4FileE.stub = !0;
      function __ZTVN6TagLib3Ogg4Opus10PropertiesE() {
        return wasmImports._ZTVN6TagLib3Ogg4Opus10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3Ogg4Opus10PropertiesE.stub = !0;
      function __ZTVN6TagLib3Ogg4Opus4FileE() {
        return wasmImports._ZTVN6TagLib3Ogg4Opus4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3Ogg4Opus4FileE.stub = !0;
      function __ZTVN6TagLib3Ogg4PageE() {
        return wasmImports._ZTVN6TagLib3Ogg4PageE.apply(null, arguments);
      }
      __ZTVN6TagLib3Ogg4PageE.stub = !0;
      function __ZTVN6TagLib3Ogg5Speex10PropertiesE() {
        return wasmImports._ZTVN6TagLib3Ogg5Speex10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib3Ogg5Speex10PropertiesE.stub = !0;
      function __ZTVN6TagLib3Ogg5Speex4FileE() {
        return wasmImports._ZTVN6TagLib3Ogg5Speex4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3Ogg5Speex4FileE.stub = !0;
      function __ZTVN6TagLib3S3M10PropertiesE() {
        return wasmImports._ZTVN6TagLib3S3M10PropertiesE.apply(null, arguments);
      }
      __ZTVN6TagLib3S3M10PropertiesE.stub = !0;
      function __ZTVN6TagLib3S3M4FileE() {
        return wasmImports._ZTVN6TagLib3S3M4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib3S3M4FileE.stub = !0;
      function __ZTVN6TagLib3TagE() {
        return wasmImports._ZTVN6TagLib3TagE.apply(null, arguments);
      }
      __ZTVN6TagLib3TagE.stub = !0;
      function __ZTVN6TagLib4FLAC10PropertiesE() {
        return wasmImports._ZTVN6TagLib4FLAC10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib4FLAC10PropertiesE.stub = !0;
      function __ZTVN6TagLib4FLAC13MetadataBlockE() {
        return wasmImports._ZTVN6TagLib4FLAC13MetadataBlockE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib4FLAC13MetadataBlockE.stub = !0;
      function __ZTVN6TagLib4FLAC20UnknownMetadataBlockE() {
        return wasmImports._ZTVN6TagLib4FLAC20UnknownMetadataBlockE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib4FLAC20UnknownMetadataBlockE.stub = !0;
      function __ZTVN6TagLib4FLAC4FileE() {
        return wasmImports._ZTVN6TagLib4FLAC4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib4FLAC4FileE.stub = !0;
      function __ZTVN6TagLib4FLAC7PictureE() {
        return wasmImports._ZTVN6TagLib4FLAC7PictureE.apply(null, arguments);
      }
      __ZTVN6TagLib4FLAC7PictureE.stub = !0;
      function __ZTVN6TagLib4FileE() {
        return wasmImports._ZTVN6TagLib4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib4FileE.stub = !0;
      function __ZTVN6TagLib4MPEG10PropertiesE() {
        return wasmImports._ZTVN6TagLib4MPEG10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib4MPEG10PropertiesE.stub = !0;
      function __ZTVN6TagLib4MPEG10XingHeaderE() {
        return wasmImports._ZTVN6TagLib4MPEG10XingHeaderE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib4MPEG10XingHeaderE.stub = !0;
      function __ZTVN6TagLib4MPEG4FileE() {
        return wasmImports._ZTVN6TagLib4MPEG4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib4MPEG4FileE.stub = !0;
      function __ZTVN6TagLib4MPEG6HeaderE() {
        return wasmImports._ZTVN6TagLib4MPEG6HeaderE.apply(null, arguments);
      }
      __ZTVN6TagLib4MPEG6HeaderE.stub = !0;
      function __ZTVN6TagLib4RIFF3WAV10PropertiesE() {
        return wasmImports._ZTVN6TagLib4RIFF3WAV10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib4RIFF3WAV10PropertiesE.stub = !0;
      function __ZTVN6TagLib4RIFF3WAV4FileE() {
        return wasmImports._ZTVN6TagLib4RIFF3WAV4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib4RIFF3WAV4FileE.stub = !0;
      function __ZTVN6TagLib4RIFF4AIFF10PropertiesE() {
        return wasmImports._ZTVN6TagLib4RIFF4AIFF10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib4RIFF4AIFF10PropertiesE.stub = !0;
      function __ZTVN6TagLib4RIFF4AIFF4FileE() {
        return wasmImports._ZTVN6TagLib4RIFF4AIFF4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib4RIFF4AIFF4FileE.stub = !0;
      function __ZTVN6TagLib4RIFF4FileE() {
        return wasmImports._ZTVN6TagLib4RIFF4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib4RIFF4FileE.stub = !0;
      function __ZTVN6TagLib4RIFF4Info13StringHandlerE() {
        return wasmImports._ZTVN6TagLib4RIFF4Info13StringHandlerE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib4RIFF4Info13StringHandlerE.stub = !0;
      function __ZTVN6TagLib4RIFF4Info3TagE() {
        return wasmImports._ZTVN6TagLib4RIFF4Info3TagE.apply(null, arguments);
      }
      __ZTVN6TagLib4RIFF4Info3TagE.stub = !0;
      function __ZTVN6TagLib5ID3v113StringHandlerE() {
        return wasmImports._ZTVN6TagLib5ID3v113StringHandlerE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v113StringHandlerE.stub = !0;
      function __ZTVN6TagLib5ID3v13TagE() {
        return wasmImports._ZTVN6TagLib5ID3v13TagE.apply(null, arguments);
      }
      __ZTVN6TagLib5ID3v13TagE.stub = !0;
      function __ZTVN6TagLib5ID3v212ChapterFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v212ChapterFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v212ChapterFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v212FrameFactoryE() {
        return wasmImports._ZTVN6TagLib5ID3v212FrameFactoryE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v212FrameFactoryE.stub = !0;
      function __ZTVN6TagLib5ID3v212PodcastFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v212PodcastFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v212PodcastFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v212PrivateFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v212PrivateFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v212PrivateFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v212UnknownFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v212UnknownFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v212UnknownFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v212UrlLinkFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v212UrlLinkFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v212UrlLinkFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v213CommentsFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v213CommentsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v213CommentsFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v214ExtendedHeaderE() {
        return wasmImports._ZTVN6TagLib5ID3v214ExtendedHeaderE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v214ExtendedHeaderE.stub = !0;
      function __ZTVN6TagLib5ID3v214OwnershipFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v214OwnershipFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v214OwnershipFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v216UserUrlLinkFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v216UserUrlLinkFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v216UserUrlLinkFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v218PopularimeterFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v218PopularimeterFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v218PopularimeterFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v219Latin1StringHandlerE() {
        return wasmImports._ZTVN6TagLib5ID3v219Latin1StringHandlerE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v219Latin1StringHandlerE.stub = !0;
      function __ZTVN6TagLib5ID3v219RelativeVolumeFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v219RelativeVolumeFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v219RelativeVolumeFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v220AttachedPictureFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v220AttachedPictureFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v220AttachedPictureFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v220TableOfContentsFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v220TableOfContentsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v220TableOfContentsFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v221EventTimingCodesFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v221EventTimingCodesFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v221EventTimingCodesFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v223AttachedPictureFrameV22E() {
        return wasmImports._ZTVN6TagLib5ID3v223AttachedPictureFrameV22E.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v223AttachedPictureFrameV22E.stub = !0;
      function __ZTVN6TagLib5ID3v223SynchronizedLyricsFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v223SynchronizedLyricsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v223SynchronizedLyricsFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v223TextIdentificationFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v223TextIdentificationFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v223TextIdentificationFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v225UniqueFileIdentifierFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v225UniqueFileIdentifierFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v225UniqueFileIdentifierFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v225UnsynchronizedLyricsFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v225UnsynchronizedLyricsFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v225UnsynchronizedLyricsFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v227UserTextIdentificationFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v227UserTextIdentificationFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v227UserTextIdentificationFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE() {
        return wasmImports._ZTVN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE.stub = !0;
      function __ZTVN6TagLib5ID3v23TagE() {
        return wasmImports._ZTVN6TagLib5ID3v23TagE.apply(null, arguments);
      }
      __ZTVN6TagLib5ID3v23TagE.stub = !0;
      function __ZTVN6TagLib5ID3v25Frame6HeaderE() {
        return wasmImports._ZTVN6TagLib5ID3v25Frame6HeaderE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib5ID3v25Frame6HeaderE.stub = !0;
      function __ZTVN6TagLib5ID3v25FrameE() {
        return wasmImports._ZTVN6TagLib5ID3v25FrameE.apply(null, arguments);
      }
      __ZTVN6TagLib5ID3v25FrameE.stub = !0;
      function __ZTVN6TagLib5ID3v26FooterE() {
        return wasmImports._ZTVN6TagLib5ID3v26FooterE.apply(null, arguments);
      }
      __ZTVN6TagLib5ID3v26FooterE.stub = !0;
      function __ZTVN6TagLib5ID3v26HeaderE() {
        return wasmImports._ZTVN6TagLib5ID3v26HeaderE.apply(null, arguments);
      }
      __ZTVN6TagLib5ID3v26HeaderE.stub = !0;
      function __ZTVN6TagLib6DSDIFF10PropertiesE() {
        return wasmImports._ZTVN6TagLib6DSDIFF10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib6DSDIFF10PropertiesE.stub = !0;
      function __ZTVN6TagLib6DSDIFF4DIIN3TagE() {
        return wasmImports._ZTVN6TagLib6DSDIFF4DIIN3TagE.apply(null, arguments);
      }
      __ZTVN6TagLib6DSDIFF4DIIN3TagE.stub = !0;
      function __ZTVN6TagLib6DSDIFF4FileE() {
        return wasmImports._ZTVN6TagLib6DSDIFF4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib6DSDIFF4FileE.stub = !0;
      function __ZTVN6TagLib6Vorbis10PropertiesE() {
        return wasmImports._ZTVN6TagLib6Vorbis10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib6Vorbis10PropertiesE.stub = !0;
      function __ZTVN6TagLib6Vorbis4FileE() {
        return wasmImports._ZTVN6TagLib6Vorbis4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib6Vorbis4FileE.stub = !0;
      function __ZTVN6TagLib7FileRef16FileTypeResolverE() {
        return wasmImports._ZTVN6TagLib7FileRef16FileTypeResolverE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib7FileRef16FileTypeResolverE.stub = !0;
      function __ZTVN6TagLib7FileRef18StreamTypeResolverE() {
        return wasmImports._ZTVN6TagLib7FileRef18StreamTypeResolverE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib7FileRef18StreamTypeResolverE.stub = !0;
      function __ZTVN6TagLib7WavPack10PropertiesE() {
        return wasmImports._ZTVN6TagLib7WavPack10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib7WavPack10PropertiesE.stub = !0;
      function __ZTVN6TagLib7WavPack4FileE() {
        return wasmImports._ZTVN6TagLib7WavPack4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib7WavPack4FileE.stub = !0;
      function __ZTVN6TagLib8IOStreamE() {
        return wasmImports._ZTVN6TagLib8IOStreamE.apply(null, arguments);
      }
      __ZTVN6TagLib8IOStreamE.stub = !0;
      function __ZTVN6TagLib8TagUnionE() {
        return wasmImports._ZTVN6TagLib8TagUnionE.apply(null, arguments);
      }
      __ZTVN6TagLib8TagUnionE.stub = !0;
      function __ZTVN6TagLib9TrueAudio10PropertiesE() {
        return wasmImports._ZTVN6TagLib9TrueAudio10PropertiesE.apply(
          null,
          arguments
        );
      }
      __ZTVN6TagLib9TrueAudio10PropertiesE.stub = !0;
      function __ZTVN6TagLib9TrueAudio4FileE() {
        return wasmImports._ZTVN6TagLib9TrueAudio4FileE.apply(null, arguments);
      }
      __ZTVN6TagLib9TrueAudio4FileE.stub = !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE.stub =
        !0;
      function __ZTVNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE() {
        return wasmImports._ZTVNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE.apply(
          null,
          arguments
        );
      }
      __ZTVNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE.stub =
        !0;
      function __ZlsRNSt3__213basic_ostreamIcNS_11char_traitsIcEEEERKN6TagLib7VariantE() {
        return wasmImports._ZlsRNSt3__213basic_ostreamIcNS_11char_traitsIcEEEERKN6TagLib7VariantE.apply(
          null,
          arguments
        );
      }
      __ZlsRNSt3__213basic_ostreamIcNS_11char_traitsIcEEEERKN6TagLib7VariantE.stub =
        !0;
      var ___assert_fail = (a, s, o, _) => {
        abort(
          `Assertion failed: ${UTF8ToString(a)}, at: ` +
            [
              s ? UTF8ToString(s) : "unknown filename",
              o,
              _ ? UTF8ToString(_) : "unknown function",
            ]
        );
      };
      ___assert_fail.sig = "vppip";
      function ExceptionInfo(a) {
        (this.excPtr = a),
          (this.ptr = a - 24),
          (this.set_type = function (s) {
            HEAPU32[(this.ptr + 4) >> 2] = s;
          }),
          (this.get_type = function () {
            return HEAPU32[(this.ptr + 4) >> 2];
          }),
          (this.set_destructor = function (s) {
            HEAPU32[(this.ptr + 8) >> 2] = s;
          }),
          (this.get_destructor = function () {
            return HEAPU32[(this.ptr + 8) >> 2];
          }),
          (this.set_caught = function (s) {
            (s = s ? 1 : 0), (HEAP8[(this.ptr + 12) >> 0] = s);
          }),
          (this.get_caught = function () {
            return HEAP8[(this.ptr + 12) >> 0] != 0;
          }),
          (this.set_rethrown = function (s) {
            (s = s ? 1 : 0), (HEAP8[(this.ptr + 13) >> 0] = s);
          }),
          (this.get_rethrown = function () {
            return HEAP8[(this.ptr + 13) >> 0] != 0;
          }),
          (this.init = function (s, o) {
            this.set_adjusted_ptr(0), this.set_type(s), this.set_destructor(o);
          }),
          (this.set_adjusted_ptr = function (s) {
            HEAPU32[(this.ptr + 16) >> 2] = s;
          }),
          (this.get_adjusted_ptr = function () {
            return HEAPU32[(this.ptr + 16) >> 2];
          }),
          (this.get_exception_ptr = function () {
            var s = ___cxa_is_pointer_type(this.get_type());
            if (s) return HEAPU32[this.excPtr >> 2];
            var o = this.get_adjusted_ptr();
            return o !== 0 ? o : this.excPtr;
          });
      }
      var exceptionLast = 0,
        ___cxa_throw = (a, s, o) => {
          var _ = new ExceptionInfo(a);
          throw (_.init(s, o), (exceptionLast = a), exceptionLast);
        };
      ___cxa_throw.sig = "vppp";
      var ___memory_base = new WebAssembly.Global(
          {
            value: "i32",
            mutable: !1,
          },
          1024
        ),
        ___stack_pointer = new WebAssembly.Global(
          {
            value: "i32",
            mutable: !0,
          },
          126352
        ),
        PATH = {
          isAbs: (a) => a.charAt(0) === "/",
          splitPath: (a) => {
            var s =
              /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
            return s.exec(a).slice(1);
          },
          normalizeArray: (a, s) => {
            for (var o = 0, _ = a.length - 1; _ >= 0; _--) {
              var c = a[_];
              c === "."
                ? a.splice(_, 1)
                : c === ".."
                ? (a.splice(_, 1), o++)
                : o && (a.splice(_, 1), o--);
            }
            if (s) for (; o; o--) a.unshift("..");
            return a;
          },
          normalize: (a) => {
            var s = PATH.isAbs(a),
              o = a.substr(-1) === "/";
            return (
              (a = PATH.normalizeArray(
                a.split("/").filter((_) => !!_),
                !s
              ).join("/")),
              !a && !s && (a = "."),
              a && o && (a += "/"),
              (s ? "/" : "") + a
            );
          },
          dirname: (a) => {
            var s = PATH.splitPath(a),
              o = s[0],
              _ = s[1];
            return !o && !_
              ? "."
              : (_ && (_ = _.substr(0, _.length - 1)), o + _);
          },
          basename: (a) => {
            if (a === "/") return "/";
            (a = PATH.normalize(a)), (a = a.replace(/\/$/, ""));
            var s = a.lastIndexOf("/");
            return s === -1 ? a : a.substr(s + 1);
          },
          join: function () {
            var a = Array.prototype.slice.call(arguments);
            return PATH.normalize(a.join("/"));
          },
          join2: (a, s) => PATH.normalize(a + "/" + s),
        },
        initRandomFill = () => {
          if (
            typeof crypto == "object" &&
            typeof crypto.getRandomValues == "function"
          )
            return (a) => crypto.getRandomValues(a);
          abort("initRandomDevice");
        },
        randomFill = (a) => (randomFill = initRandomFill())(a),
        PATH_FS = {
          resolve: function () {
            for (
              var a = "", s = !1, o = arguments.length - 1;
              o >= -1 && !s;
              o--
            ) {
              var _ = o >= 0 ? arguments[o] : FS.cwd();
              if (typeof _ != "string")
                throw new TypeError(
                  "Arguments to path.resolve must be strings"
                );
              if (!_) return "";
              (a = _ + "/" + a), (s = PATH.isAbs(_));
            }
            return (
              (a = PATH.normalizeArray(
                a.split("/").filter((c) => !!c),
                !s
              ).join("/")),
              (s ? "/" : "") + a || "."
            );
          },
          relative: (a, s) => {
            (a = PATH_FS.resolve(a).substr(1)),
              (s = PATH_FS.resolve(s).substr(1));
            function o(j) {
              for (var $ = 0; $ < j.length && j[$] === ""; $++);
              for (var et = j.length - 1; et >= 0 && j[et] === ""; et--);
              return $ > et ? [] : j.slice($, et - $ + 1);
            }
            for (
              var _ = o(a.split("/")),
                c = o(s.split("/")),
                d = Math.min(_.length, c.length),
                g = d,
                b = 0;
              b < d;
              b++
            )
              if (_[b] !== c[b]) {
                g = b;
                break;
              }
            for (var h = [], b = g; b < _.length; b++) h.push("..");
            return (h = h.concat(c.slice(g))), h.join("/");
          },
        },
        FS_stdin_getChar_buffer = [],
        lengthBytesUTF8 = (a) => {
          for (var s = 0, o = 0; o < a.length; ++o) {
            var _ = a.charCodeAt(o);
            _ <= 127
              ? s++
              : _ <= 2047
              ? (s += 2)
              : _ >= 55296 && _ <= 57343
              ? ((s += 4), ++o)
              : (s += 3);
          }
          return s;
        },
        stringToUTF8Array = (a, s, o, _) => {
          if (!(_ > 0)) return 0;
          for (var c = o, d = o + _ - 1, g = 0; g < a.length; ++g) {
            var b = a.charCodeAt(g);
            if (b >= 55296 && b <= 57343) {
              var h = a.charCodeAt(++g);
              b = (65536 + ((b & 1023) << 10)) | (h & 1023);
            }
            if (b <= 127) {
              if (o >= d) break;
              s[o++] = b;
            } else if (b <= 2047) {
              if (o + 1 >= d) break;
              (s[o++] = 192 | (b >> 6)), (s[o++] = 128 | (b & 63));
            } else if (b <= 65535) {
              if (o + 2 >= d) break;
              (s[o++] = 224 | (b >> 12)),
                (s[o++] = 128 | ((b >> 6) & 63)),
                (s[o++] = 128 | (b & 63));
            } else {
              if (o + 3 >= d) break;
              (s[o++] = 240 | (b >> 18)),
                (s[o++] = 128 | ((b >> 12) & 63)),
                (s[o++] = 128 | ((b >> 6) & 63)),
                (s[o++] = 128 | (b & 63));
            }
          }
          return (s[o] = 0), o - c;
        };
      function intArrayFromString(a, s, o) {
        var _ = lengthBytesUTF8(a) + 1,
          c = new Array(_),
          d = stringToUTF8Array(a, c, 0, c.length);
        return s && (c.length = d), c;
      }
      var FS_stdin_getChar = () => {
          if (!FS_stdin_getChar_buffer.length) {
            var a = null;
            if (
              (typeof window < "u" && typeof window.prompt == "function"
                ? ((a = window.prompt("Input: ")),
                  a !== null &&
                    (a += `
`))
                : typeof readline == "function" &&
                  ((a = readline()),
                  a !== null &&
                    (a += `
`)),
              !a)
            )
              return null;
            FS_stdin_getChar_buffer = intArrayFromString(a, !0);
          }
          return FS_stdin_getChar_buffer.shift();
        },
        TTY = {
          ttys: [],
          init() {},
          shutdown() {},
          register(a, s) {
            (TTY.ttys[a] = {
              input: [],
              output: [],
              ops: s,
            }),
              FS.registerDevice(a, TTY.stream_ops);
          },
          stream_ops: {
            open(a) {
              var s = TTY.ttys[a.node.rdev];
              if (!s) throw new FS.ErrnoError(43);
              (a.tty = s), (a.seekable = !1);
            },
            close(a) {
              a.tty.ops.fsync(a.tty);
            },
            fsync(a) {
              a.tty.ops.fsync(a.tty);
            },
            read(a, s, o, _, c) {
              if (!a.tty || !a.tty.ops.get_char) throw new FS.ErrnoError(60);
              for (var d = 0, g = 0; g < _; g++) {
                var b;
                try {
                  b = a.tty.ops.get_char(a.tty);
                } catch {
                  throw new FS.ErrnoError(29);
                }
                if (b === void 0 && d === 0) throw new FS.ErrnoError(6);
                if (b == null) break;
                d++, (s[o + g] = b);
              }
              return d && (a.node.timestamp = Date.now()), d;
            },
            write(a, s, o, _, c) {
              if (!a.tty || !a.tty.ops.put_char) throw new FS.ErrnoError(60);
              try {
                for (var d = 0; d < _; d++) a.tty.ops.put_char(a.tty, s[o + d]);
              } catch {
                throw new FS.ErrnoError(29);
              }
              return _ && (a.node.timestamp = Date.now()), d;
            },
          },
          default_tty_ops: {
            get_char(a) {
              return FS_stdin_getChar();
            },
            put_char(a, s) {
              s === null || s === 10
                ? (out(UTF8ArrayToString(a.output, 0)), (a.output = []))
                : s != 0 && a.output.push(s);
            },
            fsync(a) {
              a.output &&
                a.output.length > 0 &&
                (out(UTF8ArrayToString(a.output, 0)), (a.output = []));
            },
            ioctl_tcgets(a) {
              return {
                c_iflag: 25856,
                c_oflag: 5,
                c_cflag: 191,
                c_lflag: 35387,
                c_cc: [
                  3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                ],
              };
            },
            ioctl_tcsets(a, s, o) {
              return 0;
            },
            ioctl_tiocgwinsz(a) {
              return [24, 80];
            },
          },
          default_tty1_ops: {
            put_char(a, s) {
              s === null || s === 10
                ? (err(UTF8ArrayToString(a.output, 0)), (a.output = []))
                : s != 0 && a.output.push(s);
            },
            fsync(a) {
              a.output &&
                a.output.length > 0 &&
                (err(UTF8ArrayToString(a.output, 0)), (a.output = []));
            },
          },
        },
        mmapAlloc = (a) => {
          abort();
        },
        MEMFS = {
          ops_table: null,
          mount(a) {
            return MEMFS.createNode(null, "/", 16895, 0);
          },
          createNode(a, s, o, _) {
            if (FS.isBlkdev(o) || FS.isFIFO(o)) throw new FS.ErrnoError(63);
            MEMFS.ops_table ||
              (MEMFS.ops_table = {
                dir: {
                  node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr,
                    lookup: MEMFS.node_ops.lookup,
                    mknod: MEMFS.node_ops.mknod,
                    rename: MEMFS.node_ops.rename,
                    unlink: MEMFS.node_ops.unlink,
                    rmdir: MEMFS.node_ops.rmdir,
                    readdir: MEMFS.node_ops.readdir,
                    symlink: MEMFS.node_ops.symlink,
                  },
                  stream: {
                    llseek: MEMFS.stream_ops.llseek,
                  },
                },
                file: {
                  node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr,
                  },
                  stream: {
                    llseek: MEMFS.stream_ops.llseek,
                    read: MEMFS.stream_ops.read,
                    write: MEMFS.stream_ops.write,
                    allocate: MEMFS.stream_ops.allocate,
                    mmap: MEMFS.stream_ops.mmap,
                    msync: MEMFS.stream_ops.msync,
                  },
                },
                link: {
                  node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr,
                    readlink: MEMFS.node_ops.readlink,
                  },
                  stream: {},
                },
                chrdev: {
                  node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr,
                  },
                  stream: FS.chrdev_stream_ops,
                },
              });
            var c = FS.createNode(a, s, o, _);
            return (
              FS.isDir(c.mode)
                ? ((c.node_ops = MEMFS.ops_table.dir.node),
                  (c.stream_ops = MEMFS.ops_table.dir.stream),
                  (c.contents = {}))
                : FS.isFile(c.mode)
                ? ((c.node_ops = MEMFS.ops_table.file.node),
                  (c.stream_ops = MEMFS.ops_table.file.stream),
                  (c.usedBytes = 0),
                  (c.contents = null))
                : FS.isLink(c.mode)
                ? ((c.node_ops = MEMFS.ops_table.link.node),
                  (c.stream_ops = MEMFS.ops_table.link.stream))
                : FS.isChrdev(c.mode) &&
                  ((c.node_ops = MEMFS.ops_table.chrdev.node),
                  (c.stream_ops = MEMFS.ops_table.chrdev.stream)),
              (c.timestamp = Date.now()),
              a && ((a.contents[s] = c), (a.timestamp = c.timestamp)),
              c
            );
          },
          getFileDataAsTypedArray(a) {
            return a.contents
              ? a.contents.subarray
                ? a.contents.subarray(0, a.usedBytes)
                : new Uint8Array(a.contents)
              : new Uint8Array(0);
          },
          expandFileStorage(a, s) {
            var o = a.contents ? a.contents.length : 0;
            if (!(o >= s)) {
              var _ = 1024 * 1024;
              (s = Math.max(s, (o * (o < _ ? 2 : 1.125)) >>> 0)),
                o != 0 && (s = Math.max(s, 256));
              var c = a.contents;
              (a.contents = new Uint8Array(s)),
                a.usedBytes > 0 &&
                  a.contents.set(c.subarray(0, a.usedBytes), 0);
            }
          },
          resizeFileStorage(a, s) {
            if (a.usedBytes != s)
              if (s == 0) (a.contents = null), (a.usedBytes = 0);
              else {
                var o = a.contents;
                (a.contents = new Uint8Array(s)),
                  o && a.contents.set(o.subarray(0, Math.min(s, a.usedBytes))),
                  (a.usedBytes = s);
              }
          },
          node_ops: {
            getattr(a) {
              var s = {};
              return (
                (s.dev = FS.isChrdev(a.mode) ? a.id : 1),
                (s.ino = a.id),
                (s.mode = a.mode),
                (s.nlink = 1),
                (s.uid = 0),
                (s.gid = 0),
                (s.rdev = a.rdev),
                FS.isDir(a.mode)
                  ? (s.size = 4096)
                  : FS.isFile(a.mode)
                  ? (s.size = a.usedBytes)
                  : FS.isLink(a.mode)
                  ? (s.size = a.link.length)
                  : (s.size = 0),
                (s.atime = new Date(a.timestamp)),
                (s.mtime = new Date(a.timestamp)),
                (s.ctime = new Date(a.timestamp)),
                (s.blksize = 4096),
                (s.blocks = Math.ceil(s.size / s.blksize)),
                s
              );
            },
            setattr(a, s) {
              s.mode !== void 0 && (a.mode = s.mode),
                s.timestamp !== void 0 && (a.timestamp = s.timestamp),
                s.size !== void 0 && MEMFS.resizeFileStorage(a, s.size);
            },
            lookup(a, s) {
              throw FS.genericErrors[44];
            },
            mknod(a, s, o, _) {
              return MEMFS.createNode(a, s, o, _);
            },
            rename(a, s, o) {
              if (FS.isDir(a.mode)) {
                var _;
                try {
                  _ = FS.lookupNode(s, o);
                } catch {}
                if (_) for (var c in _.contents) throw new FS.ErrnoError(55);
              }
              delete a.parent.contents[a.name],
                (a.parent.timestamp = Date.now()),
                (a.name = o),
                (s.contents[o] = a),
                (s.timestamp = a.parent.timestamp),
                (a.parent = s);
            },
            unlink(a, s) {
              delete a.contents[s], (a.timestamp = Date.now());
            },
            rmdir(a, s) {
              var o = FS.lookupNode(a, s);
              for (var _ in o.contents) throw new FS.ErrnoError(55);
              delete a.contents[s], (a.timestamp = Date.now());
            },
            readdir(a) {
              var s = [".", ".."];
              for (var o in a.contents)
                a.contents.hasOwnProperty(o) && s.push(o);
              return s;
            },
            symlink(a, s, o) {
              var _ = MEMFS.createNode(a, s, 41471, 0);
              return (_.link = o), _;
            },
            readlink(a) {
              if (!FS.isLink(a.mode)) throw new FS.ErrnoError(28);
              return a.link;
            },
          },
          stream_ops: {
            read(a, s, o, _, c) {
              var d = a.node.contents;
              if (c >= a.node.usedBytes) return 0;
              var g = Math.min(a.node.usedBytes - c, _);
              if (g > 8 && d.subarray) s.set(d.subarray(c, c + g), o);
              else for (var b = 0; b < g; b++) s[o + b] = d[c + b];
              return g;
            },
            write(a, s, o, _, c, d) {
              if ((s.buffer === HEAP8.buffer && (d = !1), !_)) return 0;
              var g = a.node;
              if (
                ((g.timestamp = Date.now()),
                s.subarray && (!g.contents || g.contents.subarray))
              ) {
                if (d)
                  return (
                    (g.contents = s.subarray(o, o + _)), (g.usedBytes = _), _
                  );
                if (g.usedBytes === 0 && c === 0)
                  return (g.contents = s.slice(o, o + _)), (g.usedBytes = _), _;
                if (c + _ <= g.usedBytes)
                  return g.contents.set(s.subarray(o, o + _), c), _;
              }
              if (
                (MEMFS.expandFileStorage(g, c + _),
                g.contents.subarray && s.subarray)
              )
                g.contents.set(s.subarray(o, o + _), c);
              else for (var b = 0; b < _; b++) g.contents[c + b] = s[o + b];
              return (g.usedBytes = Math.max(g.usedBytes, c + _)), _;
            },
            llseek(a, s, o) {
              var _ = s;
              if (
                (o === 1
                  ? (_ += a.position)
                  : o === 2 &&
                    FS.isFile(a.node.mode) &&
                    (_ += a.node.usedBytes),
                _ < 0)
              )
                throw new FS.ErrnoError(28);
              return _;
            },
            allocate(a, s, o) {
              MEMFS.expandFileStorage(a.node, s + o),
                (a.node.usedBytes = Math.max(a.node.usedBytes, s + o));
            },
            mmap(a, s, o, _, c) {
              if (!FS.isFile(a.node.mode)) throw new FS.ErrnoError(43);
              var d,
                g,
                b = a.node.contents;
              if (!(c & 2) && b.buffer === HEAP8.buffer)
                (g = !1), (d = b.byteOffset);
              else {
                if (
                  ((o > 0 || o + s < b.length) &&
                    (b.subarray
                      ? (b = b.subarray(o, o + s))
                      : (b = Array.prototype.slice.call(b, o, o + s))),
                  (g = !0),
                  (d = mmapAlloc()),
                  !d)
                )
                  throw new FS.ErrnoError(48);
                HEAP8.set(b, d);
              }
              return {
                ptr: d,
                allocated: g,
              };
            },
            msync(a, s, o, _, c) {
              return MEMFS.stream_ops.write(a, s, 0, _, o, !1), 0;
            },
          },
        },
        FS_createDataFile = (a, s, o, _, c, d) => {
          FS.createDataFile(a, s, o, _, c, d);
        },
        FS_handledByPreloadPlugin = (a, s, o, _) => {
          typeof Browser < "u" && Browser.init();
          var c = !1;
          return (
            preloadPlugins.forEach((d) => {
              c || (d.canHandle(s) && (d.handle(a, s, o, _), (c = !0)));
            }),
            c
          );
        },
        FS_createPreloadedFile = (a, s, o, _, c, d, g, b, h, j) => {
          var $ = s ? PATH_FS.resolve(PATH.join2(a, s)) : a;
          function et(_e) {
            function it(ot) {
              j && j(),
                b || FS_createDataFile(a, s, ot, _, c, h),
                d && d(),
                removeRunDependency();
            }
            FS_handledByPreloadPlugin(_e, $, it, () => {
              g && g(), removeRunDependency();
            }) || it(_e);
          }
          addRunDependency(),
            typeof o == "string" ? asyncLoad(o, (_e) => et(_e), g) : et(o);
        },
        FS_modeStringToFlags = (a) => {
          var s = {
              r: 0,
              "r+": 2,
              w: 577,
              "w+": 578,
              a: 1089,
              "a+": 1090,
            },
            o = s[a];
          if (typeof o > "u") throw new Error(`Unknown file open mode: ${a}`);
          return o;
        },
        FS_getMode = (a, s) => {
          var o = 0;
          return a && (o |= 365), s && (o |= 146), o;
        },
        FS = {
          root: null,
          mounts: [],
          devices: {},
          streams: [],
          nextInode: 1,
          nameTable: null,
          currentPath: "/",
          initialized: !1,
          ignorePermissions: !0,
          ErrnoError: null,
          genericErrors: {},
          filesystems: null,
          syncFSRequests: 0,
          lookupPath(a, s = {}) {
            if (((a = PATH_FS.resolve(a)), !a))
              return {
                path: "",
                node: null,
              };
            var o = {
              follow_mount: !0,
              recurse_count: 0,
            };
            if (((s = Object.assign(o, s)), s.recurse_count > 8))
              throw new FS.ErrnoError(32);
            for (
              var _ = a.split("/").filter((et) => !!et),
                c = FS.root,
                d = "/",
                g = 0;
              g < _.length;
              g++
            ) {
              var b = g === _.length - 1;
              if (b && s.parent) break;
              if (
                ((c = FS.lookupNode(c, _[g])),
                (d = PATH.join2(d, _[g])),
                FS.isMountpoint(c) &&
                  (!b || (b && s.follow_mount)) &&
                  (c = c.mounted.root),
                !b || s.follow)
              )
                for (var h = 0; FS.isLink(c.mode); ) {
                  var j = FS.readlink(d);
                  d = PATH_FS.resolve(PATH.dirname(d), j);
                  var $ = FS.lookupPath(d, {
                    recurse_count: s.recurse_count + 1,
                  });
                  if (((c = $.node), h++ > 40)) throw new FS.ErrnoError(32);
                }
            }
            return {
              path: d,
              node: c,
            };
          },
          getPath(a) {
            for (var s; ; ) {
              if (FS.isRoot(a)) {
                var o = a.mount.mountpoint;
                return s ? (o[o.length - 1] !== "/" ? `${o}/${s}` : o + s) : o;
              }
              (s = s ? `${a.name}/${s}` : a.name), (a = a.parent);
            }
          },
          hashName(a, s) {
            for (var o = 0, _ = 0; _ < s.length; _++)
              o = ((o << 5) - o + s.charCodeAt(_)) | 0;
            return ((a + o) >>> 0) % FS.nameTable.length;
          },
          hashAddNode(a) {
            var s = FS.hashName(a.parent.id, a.name);
            (a.name_next = FS.nameTable[s]), (FS.nameTable[s] = a);
          },
          hashRemoveNode(a) {
            var s = FS.hashName(a.parent.id, a.name);
            if (FS.nameTable[s] === a) FS.nameTable[s] = a.name_next;
            else
              for (var o = FS.nameTable[s]; o; ) {
                if (o.name_next === a) {
                  o.name_next = a.name_next;
                  break;
                }
                o = o.name_next;
              }
          },
          lookupNode(a, s) {
            var o = FS.mayLookup(a);
            if (o) throw new FS.ErrnoError(o, a);
            for (
              var _ = FS.hashName(a.id, s), c = FS.nameTable[_];
              c;
              c = c.name_next
            ) {
              var d = c.name;
              if (c.parent.id === a.id && d === s) return c;
            }
            return FS.lookup(a, s);
          },
          createNode(a, s, o, _) {
            var c = new FS.FSNode(a, s, o, _);
            return FS.hashAddNode(c), c;
          },
          destroyNode(a) {
            FS.hashRemoveNode(a);
          },
          isRoot(a) {
            return a === a.parent;
          },
          isMountpoint(a) {
            return !!a.mounted;
          },
          isFile(a) {
            return (a & 61440) === 32768;
          },
          isDir(a) {
            return (a & 61440) === 16384;
          },
          isLink(a) {
            return (a & 61440) === 40960;
          },
          isChrdev(a) {
            return (a & 61440) === 8192;
          },
          isBlkdev(a) {
            return (a & 61440) === 24576;
          },
          isFIFO(a) {
            return (a & 61440) === 4096;
          },
          isSocket(a) {
            return (a & 49152) === 49152;
          },
          flagsToPermissionString(a) {
            var s = ["r", "w", "rw"][a & 3];
            return a & 512 && (s += "w"), s;
          },
          nodePermissions(a, s) {
            return FS.ignorePermissions
              ? 0
              : (s.includes("r") && !(a.mode & 292)) ||
                (s.includes("w") && !(a.mode & 146)) ||
                (s.includes("x") && !(a.mode & 73))
              ? 2
              : 0;
          },
          mayLookup(a) {
            var s = FS.nodePermissions(a, "x");
            return s || (a.node_ops.lookup ? 0 : 2);
          },
          mayCreate(a, s) {
            try {
              var o = FS.lookupNode(a, s);
              return 20;
            } catch {}
            return FS.nodePermissions(a, "wx");
          },
          mayDelete(a, s, o) {
            var _;
            try {
              _ = FS.lookupNode(a, s);
            } catch (d) {
              return d.errno;
            }
            var c = FS.nodePermissions(a, "wx");
            if (c) return c;
            if (o) {
              if (!FS.isDir(_.mode)) return 54;
              if (FS.isRoot(_) || FS.getPath(_) === FS.cwd()) return 10;
            } else if (FS.isDir(_.mode)) return 31;
            return 0;
          },
          mayOpen(a, s) {
            return a
              ? FS.isLink(a.mode)
                ? 32
                : FS.isDir(a.mode) &&
                  (FS.flagsToPermissionString(s) !== "r" || s & 512)
                ? 31
                : FS.nodePermissions(a, FS.flagsToPermissionString(s))
              : 44;
          },
          MAX_OPEN_FDS: 4096,
          nextfd() {
            for (var a = 0; a <= FS.MAX_OPEN_FDS; a++)
              if (!FS.streams[a]) return a;
            throw new FS.ErrnoError(33);
          },
          getStreamChecked(a) {
            var s = FS.getStream(a);
            if (!s) throw new FS.ErrnoError(8);
            return s;
          },
          getStream: (a) => FS.streams[a],
          createStream(a, s = -1) {
            return (
              FS.FSStream ||
                ((FS.FSStream = function () {
                  this.shared = {};
                }),
                (FS.FSStream.prototype = {}),
                Object.defineProperties(FS.FSStream.prototype, {
                  object: {
                    get() {
                      return this.node;
                    },
                    set(o) {
                      this.node = o;
                    },
                  },
                  isRead: {
                    get() {
                      return (this.flags & 2097155) !== 1;
                    },
                  },
                  isWrite: {
                    get() {
                      return (this.flags & 2097155) !== 0;
                    },
                  },
                  isAppend: {
                    get() {
                      return this.flags & 1024;
                    },
                  },
                  flags: {
                    get() {
                      return this.shared.flags;
                    },
                    set(o) {
                      this.shared.flags = o;
                    },
                  },
                  position: {
                    get() {
                      return this.shared.position;
                    },
                    set(o) {
                      this.shared.position = o;
                    },
                  },
                })),
              (a = Object.assign(new FS.FSStream(), a)),
              s == -1 && (s = FS.nextfd()),
              (a.fd = s),
              (FS.streams[s] = a),
              a
            );
          },
          closeStream(a) {
            FS.streams[a] = null;
          },
          chrdev_stream_ops: {
            open(a) {
              var s = FS.getDevice(a.node.rdev);
              (a.stream_ops = s.stream_ops),
                a.stream_ops.open && a.stream_ops.open(a);
            },
            llseek() {
              throw new FS.ErrnoError(70);
            },
          },
          major: (a) => a >> 8,
          minor: (a) => a & 255,
          makedev: (a, s) => (a << 8) | s,
          registerDevice(a, s) {
            FS.devices[a] = {
              stream_ops: s,
            };
          },
          getDevice: (a) => FS.devices[a],
          getMounts(a) {
            for (var s = [], o = [a]; o.length; ) {
              var _ = o.pop();
              s.push(_), o.push.apply(o, _.mounts);
            }
            return s;
          },
          syncfs(a, s) {
            typeof a == "function" && ((s = a), (a = !1)),
              FS.syncFSRequests++,
              FS.syncFSRequests > 1 &&
                err(
                  `warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`
                );
            var o = FS.getMounts(FS.root.mount),
              _ = 0;
            function c(g) {
              return FS.syncFSRequests--, s(g);
            }
            function d(g) {
              if (g) return d.errored ? void 0 : ((d.errored = !0), c(g));
              ++_ >= o.length && c(null);
            }
            o.forEach((g) => {
              if (!g.type.syncfs) return d(null);
              g.type.syncfs(g, a, d);
            });
          },
          mount(a, s, o) {
            var _ = o === "/",
              c = !o,
              d;
            if (_ && FS.root) throw new FS.ErrnoError(10);
            if (!_ && !c) {
              var g = FS.lookupPath(o, {
                follow_mount: !1,
              });
              if (((o = g.path), (d = g.node), FS.isMountpoint(d)))
                throw new FS.ErrnoError(10);
              if (!FS.isDir(d.mode)) throw new FS.ErrnoError(54);
            }
            var b = {
                type: a,
                opts: s,
                mountpoint: o,
                mounts: [],
              },
              h = a.mount(b);
            return (
              (h.mount = b),
              (b.root = h),
              _
                ? (FS.root = h)
                : d && ((d.mounted = b), d.mount && d.mount.mounts.push(b)),
              h
            );
          },
          unmount(a) {
            var s = FS.lookupPath(a, {
              follow_mount: !1,
            });
            if (!FS.isMountpoint(s.node)) throw new FS.ErrnoError(28);
            var o = s.node,
              _ = o.mounted,
              c = FS.getMounts(_);
            Object.keys(FS.nameTable).forEach((g) => {
              for (var b = FS.nameTable[g]; b; ) {
                var h = b.name_next;
                c.includes(b.mount) && FS.destroyNode(b), (b = h);
              }
            }),
              (o.mounted = null);
            var d = o.mount.mounts.indexOf(_);
            o.mount.mounts.splice(d, 1);
          },
          lookup(a, s) {
            return a.node_ops.lookup(a, s);
          },
          mknod(a, s, o) {
            var _ = FS.lookupPath(a, {
                parent: !0,
              }),
              c = _.node,
              d = PATH.basename(a);
            if (!d || d === "." || d === "..") throw new FS.ErrnoError(28);
            var g = FS.mayCreate(c, d);
            if (g) throw new FS.ErrnoError(g);
            if (!c.node_ops.mknod) throw new FS.ErrnoError(63);
            return c.node_ops.mknod(c, d, s, o);
          },
          create(a, s) {
            return (
              (s = s !== void 0 ? s : 438),
              (s &= 4095),
              (s |= 32768),
              FS.mknod(a, s, 0)
            );
          },
          mkdir(a, s) {
            return (
              (s = s !== void 0 ? s : 511),
              (s &= 1023),
              (s |= 16384),
              FS.mknod(a, s, 0)
            );
          },
          mkdirTree(a, s) {
            for (var o = a.split("/"), _ = "", c = 0; c < o.length; ++c)
              if (o[c]) {
                _ += "/" + o[c];
                try {
                  FS.mkdir(_, s);
                } catch (d) {
                  if (d.errno != 20) throw d;
                }
              }
          },
          mkdev(a, s, o) {
            return (
              typeof o > "u" && ((o = s), (s = 438)),
              (s |= 8192),
              FS.mknod(a, s, o)
            );
          },
          symlink(a, s) {
            if (!PATH_FS.resolve(a)) throw new FS.ErrnoError(44);
            var o = FS.lookupPath(s, {
                parent: !0,
              }),
              _ = o.node;
            if (!_) throw new FS.ErrnoError(44);
            var c = PATH.basename(s),
              d = FS.mayCreate(_, c);
            if (d) throw new FS.ErrnoError(d);
            if (!_.node_ops.symlink) throw new FS.ErrnoError(63);
            return _.node_ops.symlink(_, c, a);
          },
          rename(a, s) {
            var o = PATH.dirname(a),
              _ = PATH.dirname(s),
              c = PATH.basename(a),
              d = PATH.basename(s),
              g,
              b,
              h;
            if (
              ((g = FS.lookupPath(a, {
                parent: !0,
              })),
              (b = g.node),
              (g = FS.lookupPath(s, {
                parent: !0,
              })),
              (h = g.node),
              !b || !h)
            )
              throw new FS.ErrnoError(44);
            if (b.mount !== h.mount) throw new FS.ErrnoError(75);
            var j = FS.lookupNode(b, c),
              $ = PATH_FS.relative(a, _);
            if ($.charAt(0) !== ".") throw new FS.ErrnoError(28);
            if ((($ = PATH_FS.relative(s, o)), $.charAt(0) !== "."))
              throw new FS.ErrnoError(55);
            var et;
            try {
              et = FS.lookupNode(h, d);
            } catch {}
            if (j !== et) {
              var _e = FS.isDir(j.mode),
                it = FS.mayDelete(b, c, _e);
              if (it) throw new FS.ErrnoError(it);
              if (((it = et ? FS.mayDelete(h, d, _e) : FS.mayCreate(h, d)), it))
                throw new FS.ErrnoError(it);
              if (!b.node_ops.rename) throw new FS.ErrnoError(63);
              if (FS.isMountpoint(j) || (et && FS.isMountpoint(et)))
                throw new FS.ErrnoError(10);
              if (h !== b && ((it = FS.nodePermissions(b, "w")), it))
                throw new FS.ErrnoError(it);
              FS.hashRemoveNode(j);
              try {
                b.node_ops.rename(j, h, d);
              } catch (ot) {
                throw ot;
              } finally {
                FS.hashAddNode(j);
              }
            }
          },
          rmdir(a) {
            var s = FS.lookupPath(a, {
                parent: !0,
              }),
              o = s.node,
              _ = PATH.basename(a),
              c = FS.lookupNode(o, _),
              d = FS.mayDelete(o, _, !0);
            if (d) throw new FS.ErrnoError(d);
            if (!o.node_ops.rmdir) throw new FS.ErrnoError(63);
            if (FS.isMountpoint(c)) throw new FS.ErrnoError(10);
            o.node_ops.rmdir(o, _), FS.destroyNode(c);
          },
          readdir(a) {
            var s = FS.lookupPath(a, {
                follow: !0,
              }),
              o = s.node;
            if (!o.node_ops.readdir) throw new FS.ErrnoError(54);
            return o.node_ops.readdir(o);
          },
          unlink(a) {
            var s = FS.lookupPath(a, {
                parent: !0,
              }),
              o = s.node;
            if (!o) throw new FS.ErrnoError(44);
            var _ = PATH.basename(a),
              c = FS.lookupNode(o, _),
              d = FS.mayDelete(o, _, !1);
            if (d) throw new FS.ErrnoError(d);
            if (!o.node_ops.unlink) throw new FS.ErrnoError(63);
            if (FS.isMountpoint(c)) throw new FS.ErrnoError(10);
            o.node_ops.unlink(o, _), FS.destroyNode(c);
          },
          readlink(a) {
            var s = FS.lookupPath(a),
              o = s.node;
            if (!o) throw new FS.ErrnoError(44);
            if (!o.node_ops.readlink) throw new FS.ErrnoError(28);
            return PATH_FS.resolve(
              FS.getPath(o.parent),
              o.node_ops.readlink(o)
            );
          },
          stat(a, s) {
            var o = FS.lookupPath(a, {
                follow: !s,
              }),
              _ = o.node;
            if (!_) throw new FS.ErrnoError(44);
            if (!_.node_ops.getattr) throw new FS.ErrnoError(63);
            return _.node_ops.getattr(_);
          },
          lstat(a) {
            return FS.stat(a, !0);
          },
          chmod(a, s, o) {
            var _;
            if (typeof a == "string") {
              var c = FS.lookupPath(a, {
                follow: !o,
              });
              _ = c.node;
            } else _ = a;
            if (!_.node_ops.setattr) throw new FS.ErrnoError(63);
            _.node_ops.setattr(_, {
              mode: (s & 4095) | (_.mode & -4096),
              timestamp: Date.now(),
            });
          },
          lchmod(a, s) {
            FS.chmod(a, s, !0);
          },
          fchmod(a, s) {
            var o = FS.getStreamChecked(a);
            FS.chmod(o.node, s);
          },
          chown(a, s, o, _) {
            var c;
            if (typeof a == "string") {
              var d = FS.lookupPath(a, {
                follow: !_,
              });
              c = d.node;
            } else c = a;
            if (!c.node_ops.setattr) throw new FS.ErrnoError(63);
            c.node_ops.setattr(c, {
              timestamp: Date.now(),
            });
          },
          lchown(a, s, o) {
            FS.chown(a, s, o, !0);
          },
          fchown(a, s, o) {
            var _ = FS.getStreamChecked(a);
            FS.chown(_.node, s, o);
          },
          truncate(a, s) {
            if (s < 0) throw new FS.ErrnoError(28);
            var o;
            if (typeof a == "string") {
              var _ = FS.lookupPath(a, {
                follow: !0,
              });
              o = _.node;
            } else o = a;
            if (!o.node_ops.setattr) throw new FS.ErrnoError(63);
            if (FS.isDir(o.mode)) throw new FS.ErrnoError(31);
            if (!FS.isFile(o.mode)) throw new FS.ErrnoError(28);
            var c = FS.nodePermissions(o, "w");
            if (c) throw new FS.ErrnoError(c);
            o.node_ops.setattr(o, {
              size: s,
              timestamp: Date.now(),
            });
          },
          ftruncate(a, s) {
            var o = FS.getStreamChecked(a);
            if (!(o.flags & 2097155)) throw new FS.ErrnoError(28);
            FS.truncate(o.node, s);
          },
          utime(a, s, o) {
            var _ = FS.lookupPath(a, {
                follow: !0,
              }),
              c = _.node;
            c.node_ops.setattr(c, {
              timestamp: Math.max(s, o),
            });
          },
          open(a, s, o) {
            if (a === "") throw new FS.ErrnoError(44);
            (s = typeof s == "string" ? FS_modeStringToFlags(s) : s),
              (o = typeof o > "u" ? 438 : o),
              s & 64 ? (o = (o & 4095) | 32768) : (o = 0);
            var _;
            if (typeof a == "object") _ = a;
            else {
              a = PATH.normalize(a);
              try {
                var c = FS.lookupPath(a, {
                  follow: !(s & 131072),
                });
                _ = c.node;
              } catch {}
            }
            var d = !1;
            if (s & 64)
              if (_) {
                if (s & 128) throw new FS.ErrnoError(20);
              } else (_ = FS.mknod(a, o, 0)), (d = !0);
            if (!_) throw new FS.ErrnoError(44);
            if (
              (FS.isChrdev(_.mode) && (s &= -513),
              s & 65536 && !FS.isDir(_.mode))
            )
              throw new FS.ErrnoError(54);
            if (!d) {
              var g = FS.mayOpen(_, s);
              if (g) throw new FS.ErrnoError(g);
            }
            s & 512 && !d && FS.truncate(_, 0), (s &= -131713);
            var b = FS.createStream({
              node: _,
              path: FS.getPath(_),
              flags: s,
              seekable: !0,
              position: 0,
              stream_ops: _.stream_ops,
              ungotten: [],
              error: !1,
            });
            return (
              b.stream_ops.open && b.stream_ops.open(b),
              Module.logReadFiles &&
                !(s & 1) &&
                (FS.readFiles || (FS.readFiles = {}),
                a in FS.readFiles || (FS.readFiles[a] = 1)),
              b
            );
          },
          close(a) {
            if (FS.isClosed(a)) throw new FS.ErrnoError(8);
            a.getdents && (a.getdents = null);
            try {
              a.stream_ops.close && a.stream_ops.close(a);
            } catch (s) {
              throw s;
            } finally {
              FS.closeStream(a.fd);
            }
            a.fd = null;
          },
          isClosed(a) {
            return a.fd === null;
          },
          llseek(a, s, o) {
            if (FS.isClosed(a)) throw new FS.ErrnoError(8);
            if (!a.seekable || !a.stream_ops.llseek)
              throw new FS.ErrnoError(70);
            if (o != 0 && o != 1 && o != 2) throw new FS.ErrnoError(28);
            return (
              (a.position = a.stream_ops.llseek(a, s, o)),
              (a.ungotten = []),
              a.position
            );
          },
          read(a, s, o, _, c) {
            if (_ < 0 || c < 0) throw new FS.ErrnoError(28);
            if (FS.isClosed(a)) throw new FS.ErrnoError(8);
            if ((a.flags & 2097155) === 1) throw new FS.ErrnoError(8);
            if (FS.isDir(a.node.mode)) throw new FS.ErrnoError(31);
            if (!a.stream_ops.read) throw new FS.ErrnoError(28);
            var d = typeof c < "u";
            if (!d) c = a.position;
            else if (!a.seekable) throw new FS.ErrnoError(70);
            var g = a.stream_ops.read(a, s, o, _, c);
            return d || (a.position += g), g;
          },
          write(a, s, o, _, c, d) {
            if (_ < 0 || c < 0) throw new FS.ErrnoError(28);
            if (FS.isClosed(a)) throw new FS.ErrnoError(8);
            if (!(a.flags & 2097155)) throw new FS.ErrnoError(8);
            if (FS.isDir(a.node.mode)) throw new FS.ErrnoError(31);
            if (!a.stream_ops.write) throw new FS.ErrnoError(28);
            a.seekable && a.flags & 1024 && FS.llseek(a, 0, 2);
            var g = typeof c < "u";
            if (!g) c = a.position;
            else if (!a.seekable) throw new FS.ErrnoError(70);
            var b = a.stream_ops.write(a, s, o, _, c, d);
            return g || (a.position += b), b;
          },
          allocate(a, s, o) {
            if (FS.isClosed(a)) throw new FS.ErrnoError(8);
            if (s < 0 || o <= 0) throw new FS.ErrnoError(28);
            if (!(a.flags & 2097155)) throw new FS.ErrnoError(8);
            if (!FS.isFile(a.node.mode) && !FS.isDir(a.node.mode))
              throw new FS.ErrnoError(43);
            if (!a.stream_ops.allocate) throw new FS.ErrnoError(138);
            a.stream_ops.allocate(a, s, o);
          },
          mmap(a, s, o, _, c) {
            if (_ & 2 && !(c & 2) && (a.flags & 2097155) !== 2)
              throw new FS.ErrnoError(2);
            if ((a.flags & 2097155) === 1) throw new FS.ErrnoError(2);
            if (!a.stream_ops.mmap) throw new FS.ErrnoError(43);
            return a.stream_ops.mmap(a, s, o, _, c);
          },
          msync(a, s, o, _, c) {
            return a.stream_ops.msync ? a.stream_ops.msync(a, s, o, _, c) : 0;
          },
          munmap: (a) => 0,
          ioctl(a, s, o) {
            if (!a.stream_ops.ioctl) throw new FS.ErrnoError(59);
            return a.stream_ops.ioctl(a, s, o);
          },
          readFile(a, s = {}) {
            if (
              ((s.flags = s.flags || 0),
              (s.encoding = s.encoding || "binary"),
              s.encoding !== "utf8" && s.encoding !== "binary")
            )
              throw new Error(`Invalid encoding type "${s.encoding}"`);
            var o,
              _ = FS.open(a, s.flags),
              c = FS.stat(a),
              d = c.size,
              g = new Uint8Array(d);
            return (
              FS.read(_, g, 0, d, 0),
              s.encoding === "utf8"
                ? (o = UTF8ArrayToString(g, 0))
                : s.encoding === "binary" && (o = g),
              FS.close(_),
              o
            );
          },
          writeFile(a, s, o = {}) {
            o.flags = o.flags || 577;
            var _ = FS.open(a, o.flags, o.mode);
            if (typeof s == "string") {
              var c = new Uint8Array(lengthBytesUTF8(s) + 1),
                d = stringToUTF8Array(s, c, 0, c.length);
              FS.write(_, c, 0, d, void 0, o.canOwn);
            } else if (ArrayBuffer.isView(s))
              FS.write(_, s, 0, s.byteLength, void 0, o.canOwn);
            else throw new Error("Unsupported data type");
            FS.close(_);
          },
          cwd: () => FS.currentPath,
          chdir(a) {
            var s = FS.lookupPath(a, {
              follow: !0,
            });
            if (s.node === null) throw new FS.ErrnoError(44);
            if (!FS.isDir(s.node.mode)) throw new FS.ErrnoError(54);
            var o = FS.nodePermissions(s.node, "x");
            if (o) throw new FS.ErrnoError(o);
            FS.currentPath = s.path;
          },
          createDefaultDirectories() {
            FS.mkdir("/tmp"), FS.mkdir("/home"), FS.mkdir("/home/web_user");
          },
          createDefaultDevices() {
            FS.mkdir("/dev"),
              FS.registerDevice(FS.makedev(1, 3), {
                read: () => 0,
                write: (_, c, d, g, b) => g,
              }),
              FS.mkdev("/dev/null", FS.makedev(1, 3)),
              TTY.register(FS.makedev(5, 0), TTY.default_tty_ops),
              TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops),
              FS.mkdev("/dev/tty", FS.makedev(5, 0)),
              FS.mkdev("/dev/tty1", FS.makedev(6, 0));
            var a = new Uint8Array(1024),
              s = 0,
              o = () => (s === 0 && (s = randomFill(a).byteLength), a[--s]);
            FS.createDevice("/dev", "random", o),
              FS.createDevice("/dev", "urandom", o),
              FS.mkdir("/dev/shm"),
              FS.mkdir("/dev/shm/tmp");
          },
          createSpecialDirectories() {
            FS.mkdir("/proc");
            var a = FS.mkdir("/proc/self");
            FS.mkdir("/proc/self/fd"),
              FS.mount(
                {
                  mount() {
                    var s = FS.createNode(a, "fd", 16895, 73);
                    return (
                      (s.node_ops = {
                        lookup(o, _) {
                          var c = +_,
                            d = FS.getStreamChecked(c),
                            g = {
                              parent: null,
                              mount: {
                                mountpoint: "fake",
                              },
                              node_ops: {
                                readlink: () => d.path,
                              },
                            };
                          return (g.parent = g), g;
                        },
                      }),
                      s
                    );
                  },
                },
                {},
                "/proc/self/fd"
              );
          },
          createStandardStreams() {
            Module.stdin
              ? FS.createDevice("/dev", "stdin", Module.stdin)
              : FS.symlink("/dev/tty", "/dev/stdin"),
              Module.stdout
                ? FS.createDevice("/dev", "stdout", null, Module.stdout)
                : FS.symlink("/dev/tty", "/dev/stdout"),
              Module.stderr
                ? FS.createDevice("/dev", "stderr", null, Module.stderr)
                : FS.symlink("/dev/tty1", "/dev/stderr"),
              FS.open("/dev/stdin", 0),
              FS.open("/dev/stdout", 1),
              FS.open("/dev/stderr", 1);
          },
          ensureErrnoError() {
            FS.ErrnoError ||
              ((FS.ErrnoError = function (s, o) {
                (this.name = "ErrnoError"),
                  (this.node = o),
                  (this.setErrno = function (_) {
                    this.errno = _;
                  }),
                  this.setErrno(s),
                  (this.message = "FS error");
              }),
              (FS.ErrnoError.prototype = new Error()),
              (FS.ErrnoError.prototype.constructor = FS.ErrnoError),
              [44].forEach((a) => {
                (FS.genericErrors[a] = new FS.ErrnoError(a)),
                  (FS.genericErrors[a].stack = "<generic error, no stack>");
              }));
          },
          staticInit() {
            FS.ensureErrnoError(),
              (FS.nameTable = new Array(4096)),
              FS.mount(MEMFS, {}, "/"),
              FS.createDefaultDirectories(),
              FS.createDefaultDevices(),
              FS.createSpecialDirectories(),
              (FS.filesystems = {
                MEMFS,
              });
          },
          init(a, s, o) {
            (FS.init.initialized = !0),
              FS.ensureErrnoError(),
              (Module.stdin = a || Module.stdin),
              (Module.stdout = s || Module.stdout),
              (Module.stderr = o || Module.stderr),
              FS.createStandardStreams();
          },
          quit() {
            (FS.init.initialized = !1), _fflush(0);
            for (var a = 0; a < FS.streams.length; a++) {
              var s = FS.streams[a];
              s && FS.close(s);
            }
          },
          findObject(a, s) {
            var o = FS.analyzePath(a, s);
            return o.exists ? o.object : null;
          },
          analyzePath(a, s) {
            try {
              var o = FS.lookupPath(a, {
                follow: !s,
              });
              a = o.path;
            } catch {}
            var _ = {
              isRoot: !1,
              exists: !1,
              error: 0,
              name: null,
              path: null,
              object: null,
              parentExists: !1,
              parentPath: null,
              parentObject: null,
            };
            try {
              var o = FS.lookupPath(a, {
                parent: !0,
              });
              (_.parentExists = !0),
                (_.parentPath = o.path),
                (_.parentObject = o.node),
                (_.name = PATH.basename(a)),
                (o = FS.lookupPath(a, {
                  follow: !s,
                })),
                (_.exists = !0),
                (_.path = o.path),
                (_.object = o.node),
                (_.name = o.node.name),
                (_.isRoot = o.path === "/");
            } catch (c) {
              _.error = c.errno;
            }
            return _;
          },
          createPath(a, s, o, _) {
            a = typeof a == "string" ? a : FS.getPath(a);
            for (var c = s.split("/").reverse(); c.length; ) {
              var d = c.pop();
              if (d) {
                var g = PATH.join2(a, d);
                try {
                  FS.mkdir(g);
                } catch {}
                a = g;
              }
            }
            return g;
          },
          createFile(a, s, o, _, c) {
            var d = PATH.join2(typeof a == "string" ? a : FS.getPath(a), s),
              g = FS_getMode(_, c);
            return FS.create(d, g);
          },
          createDataFile(a, s, o, _, c, d) {
            var g = s;
            a &&
              ((a = typeof a == "string" ? a : FS.getPath(a)),
              (g = s ? PATH.join2(a, s) : a));
            var b = FS_getMode(_, c),
              h = FS.create(g, b);
            if (o) {
              if (typeof o == "string") {
                for (
                  var j = new Array(o.length), $ = 0, et = o.length;
                  $ < et;
                  ++$
                )
                  j[$] = o.charCodeAt($);
                o = j;
              }
              FS.chmod(h, b | 146);
              var _e = FS.open(h, 577);
              FS.write(_e, o, 0, o.length, 0, d), FS.close(_e), FS.chmod(h, b);
            }
          },
          createDevice(a, s, o, _) {
            var c = PATH.join2(typeof a == "string" ? a : FS.getPath(a), s),
              d = FS_getMode(!!o, !!_);
            FS.createDevice.major || (FS.createDevice.major = 64);
            var g = FS.makedev(FS.createDevice.major++, 0);
            return (
              FS.registerDevice(g, {
                open(b) {
                  b.seekable = !1;
                },
                close(b) {
                  _ && _.buffer && _.buffer.length && _(10);
                },
                read(b, h, j, $, et) {
                  for (var _e = 0, it = 0; it < $; it++) {
                    var ot;
                    try {
                      ot = o();
                    } catch {
                      throw new FS.ErrnoError(29);
                    }
                    if (ot === void 0 && _e === 0) throw new FS.ErrnoError(6);
                    if (ot == null) break;
                    _e++, (h[j + it] = ot);
                  }
                  return _e && (b.node.timestamp = Date.now()), _e;
                },
                write(b, h, j, $, et) {
                  for (var _e = 0; _e < $; _e++)
                    try {
                      _(h[j + _e]);
                    } catch {
                      throw new FS.ErrnoError(29);
                    }
                  return $ && (b.node.timestamp = Date.now()), _e;
                },
              }),
              FS.mkdev(c, d, g)
            );
          },
          forceLoadFile(a) {
            if (a.isDevice || a.isFolder || a.link || a.contents) return !0;
            if (typeof XMLHttpRequest < "u")
              throw new Error(
                "Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread."
              );
            if (read_)
              try {
                (a.contents = intArrayFromString(read_(a.url), !0)),
                  (a.usedBytes = a.contents.length);
              } catch {
                throw new FS.ErrnoError(29);
              }
            else
              throw new Error("Cannot load without read() or XMLHttpRequest.");
          },
          createLazyFile(a, s, o, _, c) {
            function d() {
              (this.lengthKnown = !1), (this.chunks = []);
            }
            if (
              ((d.prototype.get = function (it) {
                if (!(it > this.length - 1 || it < 0)) {
                  var ot = it % this.chunkSize,
                    st = (it / this.chunkSize) | 0;
                  return this.getter(st)[ot];
                }
              }),
              (d.prototype.setDataGetter = function (it) {
                this.getter = it;
              }),
              (d.prototype.cacheLength = function () {
                var it = new XMLHttpRequest();
                if (
                  (it.open("HEAD", o, !1),
                  it.send(null),
                  !((it.status >= 200 && it.status < 300) || it.status === 304))
                )
                  throw new Error(
                    "Couldn't load " + o + ". Status: " + it.status
                  );
                var ot = Number(it.getResponseHeader("Content-length")),
                  st,
                  nt =
                    (st = it.getResponseHeader("Accept-Ranges")) &&
                    st === "bytes",
                  rt =
                    (st = it.getResponseHeader("Content-Encoding")) &&
                    st === "gzip",
                  tt = 1024 * 1024;
                nt || (tt = ot);
                var at = (lt, _t) => {
                    if (lt > _t)
                      throw new Error(
                        "invalid range (" +
                          lt +
                          ", " +
                          _t +
                          ") or no bytes requested!"
                      );
                    if (_t > ot - 1)
                      throw new Error(
                        "only " + ot + " bytes available! programmer error!"
                      );
                    var ut = new XMLHttpRequest();
                    if (
                      (ut.open("GET", o, !1),
                      ot !== tt &&
                        ut.setRequestHeader("Range", "bytes=" + lt + "-" + _t),
                      (ut.responseType = "arraybuffer"),
                      ut.overrideMimeType &&
                        ut.overrideMimeType(
                          "text/plain; charset=x-user-defined"
                        ),
                      ut.send(null),
                      !(
                        (ut.status >= 200 && ut.status < 300) ||
                        ut.status === 304
                      ))
                    )
                      throw new Error(
                        "Couldn't load " + o + ". Status: " + ut.status
                      );
                    return ut.response !== void 0
                      ? new Uint8Array(ut.response || [])
                      : intArrayFromString(ut.responseText || "", !0);
                  },
                  Et = this;
                Et.setDataGetter((lt) => {
                  var _t = lt * tt,
                    ut = (lt + 1) * tt - 1;
                  if (
                    ((ut = Math.min(ut, ot - 1)),
                    typeof Et.chunks[lt] > "u" && (Et.chunks[lt] = at(_t, ut)),
                    typeof Et.chunks[lt] > "u")
                  )
                    throw new Error("doXHR failed!");
                  return Et.chunks[lt];
                }),
                  (rt || !ot) &&
                    ((tt = ot = 1),
                    (ot = this.getter(0).length),
                    (tt = ot),
                    out(
                      "LazyFiles on gzip forces download of the whole file when length is accessed"
                    )),
                  (this._length = ot),
                  (this._chunkSize = tt),
                  (this.lengthKnown = !0);
              }),
              typeof XMLHttpRequest < "u")
            ) {
              throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
              var g, b;
            } else
              var b = {
                isDevice: !1,
                url: o,
              };
            var h = FS.createFile(a, s, b, _, c);
            b.contents
              ? (h.contents = b.contents)
              : b.url && ((h.contents = null), (h.url = b.url)),
              Object.defineProperties(h, {
                usedBytes: {
                  get: function () {
                    return this.contents.length;
                  },
                },
              });
            var j = {},
              $ = Object.keys(h.stream_ops);
            $.forEach((_e) => {
              var it = h.stream_ops[_e];
              j[_e] = function () {
                return FS.forceLoadFile(h), it.apply(null, arguments);
              };
            });
            function et(_e, it, ot, st, nt) {
              var rt = _e.node.contents;
              if (nt >= rt.length) return 0;
              var tt = Math.min(rt.length - nt, st);
              if (rt.slice)
                for (var at = 0; at < tt; at++) it[ot + at] = rt[nt + at];
              else
                for (var at = 0; at < tt; at++) it[ot + at] = rt.get(nt + at);
              return tt;
            }
            return (
              (j.read = (_e, it, ot, st, nt) => (
                FS.forceLoadFile(h), et(_e, it, ot, st, nt)
              )),
              (j.mmap = (_e, it, ot, st, nt) => {
                FS.forceLoadFile(h);
                var rt = mmapAlloc();
                if (!rt) throw new FS.ErrnoError(48);
                return (
                  et(_e, HEAP8, rt, it, ot),
                  {
                    ptr: rt,
                    allocated: !0,
                  }
                );
              }),
              (h.stream_ops = j),
              h
            );
          },
        };
      Module.FS = FS;
      var SYSCALLS = {
        DEFAULT_POLLMASK: 5,
        calculateAt(a, s, o) {
          if (PATH.isAbs(s)) return s;
          var _;
          if (a === -100) _ = FS.cwd();
          else {
            var c = SYSCALLS.getStreamFromFD(a);
            _ = c.path;
          }
          if (s.length == 0) {
            if (!o) throw new FS.ErrnoError(44);
            return _;
          }
          return PATH.join2(_, s);
        },
        doStat(a, s, o) {
          try {
            var _ = a(s);
          } catch (b) {
            if (
              b &&
              b.node &&
              PATH.normalize(s) !== PATH.normalize(FS.getPath(b.node))
            )
              return -54;
            throw b;
          }
          (HEAP32[o >> 2] = _.dev),
            (HEAP32[(o + 4) >> 2] = _.mode),
            (HEAPU32[(o + 8) >> 2] = _.nlink),
            (HEAP32[(o + 12) >> 2] = _.uid),
            (HEAP32[(o + 16) >> 2] = _.gid),
            (HEAP32[(o + 20) >> 2] = _.rdev),
            (tempI64 = [
              _.size >>> 0,
              ((tempDouble = _.size),
              +Math.abs(tempDouble) >= 1
                ? tempDouble > 0
                  ? +Math.floor(tempDouble / 4294967296) >>> 0
                  : ~~+Math.ceil(
                      (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                    ) >>> 0
                : 0),
            ]),
            (HEAP32[(o + 24) >> 2] = tempI64[0]),
            (HEAP32[(o + 28) >> 2] = tempI64[1]),
            (HEAP32[(o + 32) >> 2] = 4096),
            (HEAP32[(o + 36) >> 2] = _.blocks);
          var c = _.atime.getTime(),
            d = _.mtime.getTime(),
            g = _.ctime.getTime();
          return (
            (tempI64 = [
              Math.floor(c / 1e3) >>> 0,
              ((tempDouble = Math.floor(c / 1e3)),
              +Math.abs(tempDouble) >= 1
                ? tempDouble > 0
                  ? +Math.floor(tempDouble / 4294967296) >>> 0
                  : ~~+Math.ceil(
                      (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                    ) >>> 0
                : 0),
            ]),
            (HEAP32[(o + 40) >> 2] = tempI64[0]),
            (HEAP32[(o + 44) >> 2] = tempI64[1]),
            (HEAPU32[(o + 48) >> 2] = (c % 1e3) * 1e3),
            (tempI64 = [
              Math.floor(d / 1e3) >>> 0,
              ((tempDouble = Math.floor(d / 1e3)),
              +Math.abs(tempDouble) >= 1
                ? tempDouble > 0
                  ? +Math.floor(tempDouble / 4294967296) >>> 0
                  : ~~+Math.ceil(
                      (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                    ) >>> 0
                : 0),
            ]),
            (HEAP32[(o + 56) >> 2] = tempI64[0]),
            (HEAP32[(o + 60) >> 2] = tempI64[1]),
            (HEAPU32[(o + 64) >> 2] = (d % 1e3) * 1e3),
            (tempI64 = [
              Math.floor(g / 1e3) >>> 0,
              ((tempDouble = Math.floor(g / 1e3)),
              +Math.abs(tempDouble) >= 1
                ? tempDouble > 0
                  ? +Math.floor(tempDouble / 4294967296) >>> 0
                  : ~~+Math.ceil(
                      (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                    ) >>> 0
                : 0),
            ]),
            (HEAP32[(o + 72) >> 2] = tempI64[0]),
            (HEAP32[(o + 76) >> 2] = tempI64[1]),
            (HEAPU32[(o + 80) >> 2] = (g % 1e3) * 1e3),
            (tempI64 = [
              _.ino >>> 0,
              ((tempDouble = _.ino),
              +Math.abs(tempDouble) >= 1
                ? tempDouble > 0
                  ? +Math.floor(tempDouble / 4294967296) >>> 0
                  : ~~+Math.ceil(
                      (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                    ) >>> 0
                : 0),
            ]),
            (HEAP32[(o + 88) >> 2] = tempI64[0]),
            (HEAP32[(o + 92) >> 2] = tempI64[1]),
            0
          );
        },
        doMsync(a, s, o, _, c) {
          if (!FS.isFile(s.node.mode)) throw new FS.ErrnoError(43);
          if (_ & 2) return 0;
          var d = HEAPU8.slice(a, a + o);
          FS.msync(s, d, c, o, _);
        },
        varargs: void 0,
        get() {
          var a = HEAP32[+SYSCALLS.varargs >> 2];
          return (SYSCALLS.varargs += 4), a;
        },
        getp() {
          return SYSCALLS.get();
        },
        getStr(a) {
          var s = UTF8ToString(a);
          return s;
        },
        getStreamFromFD(a) {
          var s = FS.getStreamChecked(a);
          return s;
        },
      };
      function ___syscall_faccessat(a, s, o, _) {
        try {
          if (
            ((s = SYSCALLS.getStr(s)), (s = SYSCALLS.calculateAt(a, s)), o & -8)
          )
            return -28;
          var c = FS.lookupPath(s, {
              follow: !0,
            }),
            d = c.node;
          if (!d) return -44;
          var g = "";
          return (
            o & 4 && (g += "r"),
            o & 2 && (g += "w"),
            o & 1 && (g += "x"),
            g && FS.nodePermissions(d, g) ? -2 : 0
          );
        } catch (b) {
          if (typeof FS > "u" || b.name !== "ErrnoError") throw b;
          return -b.errno;
        }
      }
      ___syscall_faccessat.sig = "iipii";
      var setErrNo = (a) => ((HEAP32[___errno_location() >> 2] = a), a);
      function ___syscall_fcntl64(a, s, o) {
        SYSCALLS.varargs = o;
        try {
          var _ = SYSCALLS.getStreamFromFD(a);
          switch (s) {
            case 0: {
              var c = SYSCALLS.get();
              if (c < 0) return -28;
              for (; FS.streams[c]; ) c++;
              var d;
              return (d = FS.createStream(_, c)), d.fd;
            }
            case 1:
            case 2:
              return 0;
            case 3:
              return _.flags;
            case 4: {
              var c = SYSCALLS.get();
              return (_.flags |= c), 0;
            }
            case 5: {
              var c = SYSCALLS.getp(),
                g = 0;
              return (HEAP16[(c + g) >> 1] = 2), 0;
            }
            case 6:
            case 7:
              return 0;
            case 16:
            case 8:
              return -28;
            case 9:
              return setErrNo(28), -1;
            default:
              return -28;
          }
        } catch (b) {
          if (typeof FS > "u" || b.name !== "ErrnoError") throw b;
          return -b.errno;
        }
      }
      ___syscall_fcntl64.sig = "iiip";
      function ___syscall_fstat64(a, s) {
        try {
          var o = SYSCALLS.getStreamFromFD(a);
          return SYSCALLS.doStat(FS.stat, o.path, s);
        } catch (_) {
          if (typeof FS > "u" || _.name !== "ErrnoError") throw _;
          return -_.errno;
        }
      }
      ___syscall_fstat64.sig = "iip";
      var convertI32PairToI53Checked = (a, s) =>
        (s + 2097152) >>> 0 < 4194305 - !!a ? (a >>> 0) + s * 4294967296 : NaN;
      function ___syscall_ftruncate64(a, s, o) {
        var _ = convertI32PairToI53Checked(s, o);
        try {
          return isNaN(_) ? 61 : (FS.ftruncate(a, _), 0);
        } catch (c) {
          if (typeof FS > "u" || c.name !== "ErrnoError") throw c;
          return -c.errno;
        }
      }
      ___syscall_ftruncate64.sig = "iiii";
      function ___syscall_ioctl(a, s, o) {
        SYSCALLS.varargs = o;
        try {
          var _ = SYSCALLS.getStreamFromFD(a);
          switch (s) {
            case 21509:
              return _.tty ? 0 : -59;
            case 21505: {
              if (!_.tty) return -59;
              if (_.tty.ops.ioctl_tcgets) {
                var c = _.tty.ops.ioctl_tcgets(_),
                  d = SYSCALLS.getp();
                (HEAP32[d >> 2] = c.c_iflag || 0),
                  (HEAP32[(d + 4) >> 2] = c.c_oflag || 0),
                  (HEAP32[(d + 8) >> 2] = c.c_cflag || 0),
                  (HEAP32[(d + 12) >> 2] = c.c_lflag || 0);
                for (var g = 0; g < 32; g++)
                  HEAP8[(d + g + 17) >> 0] = c.c_cc[g] || 0;
                return 0;
              }
              return 0;
            }
            case 21510:
            case 21511:
            case 21512:
              return _.tty ? 0 : -59;
            case 21506:
            case 21507:
            case 21508: {
              if (!_.tty) return -59;
              if (_.tty.ops.ioctl_tcsets) {
                for (
                  var d = SYSCALLS.getp(),
                    b = HEAP32[d >> 2],
                    h = HEAP32[(d + 4) >> 2],
                    j = HEAP32[(d + 8) >> 2],
                    $ = HEAP32[(d + 12) >> 2],
                    et = [],
                    g = 0;
                  g < 32;
                  g++
                )
                  et.push(HEAP8[(d + g + 17) >> 0]);
                return _.tty.ops.ioctl_tcsets(_.tty, s, {
                  c_iflag: b,
                  c_oflag: h,
                  c_cflag: j,
                  c_lflag: $,
                  c_cc: et,
                });
              }
              return 0;
            }
            case 21519: {
              if (!_.tty) return -59;
              var d = SYSCALLS.getp();
              return (HEAP32[d >> 2] = 0), 0;
            }
            case 21520:
              return _.tty ? -28 : -59;
            case 21531: {
              var d = SYSCALLS.getp();
              return FS.ioctl(_, s, d);
            }
            case 21523: {
              if (!_.tty) return -59;
              if (_.tty.ops.ioctl_tiocgwinsz) {
                var _e = _.tty.ops.ioctl_tiocgwinsz(_.tty),
                  d = SYSCALLS.getp();
                (HEAP16[d >> 1] = _e[0]), (HEAP16[(d + 2) >> 1] = _e[1]);
              }
              return 0;
            }
            case 21524:
              return _.tty ? 0 : -59;
            case 21515:
              return _.tty ? 0 : -59;
            default:
              return -28;
          }
        } catch (it) {
          if (typeof FS > "u" || it.name !== "ErrnoError") throw it;
          return -it.errno;
        }
      }
      ___syscall_ioctl.sig = "iiip";
      function ___syscall_lstat64(a, s) {
        try {
          return (a = SYSCALLS.getStr(a)), SYSCALLS.doStat(FS.lstat, a, s);
        } catch (o) {
          if (typeof FS > "u" || o.name !== "ErrnoError") throw o;
          return -o.errno;
        }
      }
      ___syscall_lstat64.sig = "ipp";
      function ___syscall_newfstatat(a, s, o, _) {
        try {
          s = SYSCALLS.getStr(s);
          var c = _ & 256,
            d = _ & 4096;
          return (
            (_ = _ & -6401),
            (s = SYSCALLS.calculateAt(a, s, d)),
            SYSCALLS.doStat(c ? FS.lstat : FS.stat, s, o)
          );
        } catch (g) {
          if (typeof FS > "u" || g.name !== "ErrnoError") throw g;
          return -g.errno;
        }
      }
      ___syscall_newfstatat.sig = "iippi";
      function ___syscall_openat(a, s, o, _) {
        SYSCALLS.varargs = _;
        try {
          (s = SYSCALLS.getStr(s)), (s = SYSCALLS.calculateAt(a, s));
          var c = _ ? SYSCALLS.get() : 0;
          return FS.open(s, o, c).fd;
        } catch (d) {
          if (typeof FS > "u" || d.name !== "ErrnoError") throw d;
          return -d.errno;
        }
      }
      ___syscall_openat.sig = "iipip";
      function ___syscall_rmdir(a) {
        try {
          return (a = SYSCALLS.getStr(a)), FS.rmdir(a), 0;
        } catch (s) {
          if (typeof FS > "u" || s.name !== "ErrnoError") throw s;
          return -s.errno;
        }
      }
      ___syscall_rmdir.sig = "ip";
      function ___syscall_stat64(a, s) {
        try {
          return (a = SYSCALLS.getStr(a)), SYSCALLS.doStat(FS.stat, a, s);
        } catch (o) {
          if (typeof FS > "u" || o.name !== "ErrnoError") throw o;
          return -o.errno;
        }
      }
      ___syscall_stat64.sig = "ipp";
      function ___syscall_unlinkat(a, s, o) {
        try {
          return (
            (s = SYSCALLS.getStr(s)),
            (s = SYSCALLS.calculateAt(a, s)),
            o === 0
              ? FS.unlink(s)
              : o === 512
              ? FS.rmdir(s)
              : abort("Invalid flags passed to unlinkat"),
            0
          );
        } catch (_) {
          if (typeof FS > "u" || _.name !== "ErrnoError") throw _;
          return -_.errno;
        }
      }
      ___syscall_unlinkat.sig = "iipi";
      var ___table_base = new WebAssembly.Global(
          {
            value: "i32",
            mutable: !1,
          },
          1
        ),
        structRegistrations = {},
        runDestructors = (a) => {
          for (; a.length; ) {
            var s = a.pop(),
              o = a.pop();
            o(s);
          }
        };
      function simpleReadValueFromPointer(a) {
        return this.fromWireType(HEAP32[a >> 2]);
      }
      var awaitingDependencies = {},
        registeredTypes = {},
        typeDependencies = {},
        InternalError,
        throwInternalError = (a) => {
          throw new InternalError(a);
        },
        whenDependentTypesAreResolved = (a, s, o) => {
          a.forEach(function (b) {
            typeDependencies[b] = s;
          });
          function _(b) {
            var h = o(b);
            h.length !== a.length &&
              throwInternalError("Mismatched type converter count");
            for (var j = 0; j < a.length; ++j) registerType(a[j], h[j]);
          }
          var c = new Array(s.length),
            d = [],
            g = 0;
          s.forEach((b, h) => {
            registeredTypes.hasOwnProperty(b)
              ? (c[h] = registeredTypes[b])
              : (d.push(b),
                awaitingDependencies.hasOwnProperty(b) ||
                  (awaitingDependencies[b] = []),
                awaitingDependencies[b].push(() => {
                  (c[h] = registeredTypes[b]), ++g, g === d.length && _(c);
                }));
          }),
            d.length === 0 && _(c);
        },
        __embind_finalize_value_object = (a) => {
          var s = structRegistrations[a];
          delete structRegistrations[a];
          var o = s.rawConstructor,
            _ = s.rawDestructor,
            c = s.fields,
            d = c
              .map((g) => g.getterReturnType)
              .concat(c.map((g) => g.setterArgumentType));
          whenDependentTypesAreResolved([a], d, (g) => {
            var b = {};
            return (
              c.forEach((h, j) => {
                var $ = h.fieldName,
                  et = g[j],
                  _e = h.getter,
                  it = h.getterContext,
                  ot = g[j + c.length],
                  st = h.setter,
                  nt = h.setterContext;
                b[$] = {
                  read: (rt) => et.fromWireType(_e(it, rt)),
                  write: (rt, tt) => {
                    var at = [];
                    st(nt, rt, ot.toWireType(at, tt)), runDestructors(at);
                  },
                };
              }),
              [
                {
                  name: s.name,
                  fromWireType: (h) => {
                    var j = {};
                    for (var $ in b) j[$] = b[$].read(h);
                    return _(h), j;
                  },
                  toWireType: (h, j) => {
                    for (var $ in b)
                      if (!($ in j))
                        throw new TypeError(`Missing field: "${$}"`);
                    var et = o();
                    for ($ in b) b[$].write(et, j[$]);
                    return h !== null && h.push(_, et), et;
                  },
                  argPackAdvance: GenericWireTypeSize,
                  readValueFromPointer: simpleReadValueFromPointer,
                  destructorFunction: _,
                },
              ]
            );
          });
        };
      __embind_finalize_value_object.sig = "vp";
      var __embind_register_bigint = (a, s, o, _, c) => {};
      __embind_register_bigint.sig = "vpppiiii";
      var embind_init_charCodes = () => {
          for (var a = new Array(256), s = 0; s < 256; ++s)
            a[s] = String.fromCharCode(s);
          embind_charCodes = a;
        },
        embind_charCodes,
        readLatin1String = (a) => {
          for (var s = "", o = a; HEAPU8[o]; )
            s += embind_charCodes[HEAPU8[o++]];
          return s;
        },
        BindingError,
        throwBindingError = (a) => {
          throw new BindingError(a);
        };
      function sharedRegisterType(a, s, o = {}) {
        var _ = s.name;
        if (
          (a ||
            throwBindingError(
              `type "${_}" must have a positive integer typeid pointer`
            ),
          registeredTypes.hasOwnProperty(a))
        ) {
          if (o.ignoreDuplicateRegistrations) return;
          throwBindingError(`Cannot register type '${_}' twice`);
        }
        if (
          ((registeredTypes[a] = s),
          delete typeDependencies[a],
          awaitingDependencies.hasOwnProperty(a))
        ) {
          var c = awaitingDependencies[a];
          delete awaitingDependencies[a], c.forEach((d) => d());
        }
      }
      function registerType(a, s, o = {}) {
        if (!("argPackAdvance" in s))
          throw new TypeError(
            "registerType registeredInstance requires argPackAdvance"
          );
        return sharedRegisterType(a, s, o);
      }
      var GenericWireTypeSize = 8,
        __embind_register_bool = (a, s, o, _) => {
          (s = readLatin1String(s)),
            registerType(a, {
              name: s,
              fromWireType: function (c) {
                return !!c;
              },
              toWireType: function (c, d) {
                return d ? o : _;
              },
              argPackAdvance: GenericWireTypeSize,
              readValueFromPointer: function (c) {
                return this.fromWireType(HEAPU8[c]);
              },
              destructorFunction: null,
            });
        };
      __embind_register_bool.sig = "vppii";
      function handleAllocatorInit() {
        Object.assign(HandleAllocator.prototype, {
          get(a) {
            return this.allocated[a];
          },
          has(a) {
            return this.allocated[a] !== void 0;
          },
          allocate(a) {
            var s = this.freelist.pop() || this.allocated.length;
            return (this.allocated[s] = a), s;
          },
          free(a) {
            (this.allocated[a] = void 0), this.freelist.push(a);
          },
        });
      }
      function HandleAllocator() {
        (this.allocated = [void 0]), (this.freelist = []);
      }
      var emval_handles = new HandleAllocator(),
        __emval_decref = (a) => {
          a >= emval_handles.reserved &&
            --emval_handles.get(a).refcount === 0 &&
            emval_handles.free(a);
        };
      __emval_decref.sig = "vp";
      var count_emval_handles = () => {
          for (
            var a = 0, s = emval_handles.reserved;
            s < emval_handles.allocated.length;
            ++s
          )
            emval_handles.allocated[s] !== void 0 && ++a;
          return a;
        },
        init_emval = () => {
          emval_handles.allocated.push(
            {
              value: void 0,
            },
            {
              value: null,
            },
            {
              value: !0,
            },
            {
              value: !1,
            }
          ),
            (emval_handles.reserved = emval_handles.allocated.length),
            (Module.count_emval_handles = count_emval_handles);
        },
        Emval = {
          toValue: (a) => (
            a || throwBindingError("Cannot use deleted val. handle = " + a),
            emval_handles.get(a).value
          ),
          toHandle: (a) => {
            switch (a) {
              case void 0:
                return 1;
              case null:
                return 2;
              case !0:
                return 3;
              case !1:
                return 4;
              default:
                return emval_handles.allocate({
                  refcount: 1,
                  value: a,
                });
            }
          },
        },
        __embind_register_emval = (a, s) => {
          (s = readLatin1String(s)),
            registerType(a, {
              name: s,
              fromWireType: (o) => {
                var _ = Emval.toValue(o);
                return __emval_decref(o), _;
              },
              toWireType: (o, _) => Emval.toHandle(_),
              argPackAdvance: GenericWireTypeSize,
              readValueFromPointer: simpleReadValueFromPointer,
              destructorFunction: null,
            });
        };
      __embind_register_emval.sig = "vpp";
      var floatReadValueFromPointer = (a, s) => {
          switch (s) {
            case 4:
              return function (o) {
                return this.fromWireType(HEAPF32[o >> 2]);
              };
            case 8:
              return function (o) {
                return this.fromWireType(HEAPF64[o >> 3]);
              };
            default:
              throw new TypeError(`invalid float width (${s}): ${a}`);
          }
        },
        __embind_register_float = (a, s, o) => {
          (s = readLatin1String(s)),
            registerType(a, {
              name: s,
              fromWireType: (_) => _,
              toWireType: (_, c) => c,
              argPackAdvance: GenericWireTypeSize,
              readValueFromPointer: floatReadValueFromPointer(s, o),
              destructorFunction: null,
            });
        };
      __embind_register_float.sig = "vppp";
      var createNamedFunction = (a, s) =>
        Object.defineProperty(s, "name", {
          value: a,
        });
      function newFunc(a, s) {
        if (!(a instanceof Function))
          throw new TypeError(
            `new_ called with constructor type ${typeof a} which is not a function`
          );
        var o = createNamedFunction(
          a.name || "unknownFunctionName",
          function () {}
        );
        o.prototype = a.prototype;
        var _ = new o(),
          c = a.apply(_, s);
        return c instanceof Object ? c : _;
      }
      function craftInvokerFunction(a, s, o, _, c, d) {
        var g = s.length;
        g < 2 &&
          throwBindingError(
            "argTypes array size mismatch! Must at least get return value and 'this' types!"
          );
        for (
          var b = s[1] !== null && o !== null, h = !1, j = 1;
          j < s.length;
          ++j
        )
          if (s[j] !== null && s[j].destructorFunction === void 0) {
            h = !0;
            break;
          }
        for (
          var $ = s[0].name !== "void", et = "", _e = "", j = 0;
          j < g - 2;
          ++j
        )
          (et += (j !== 0 ? ", " : "") + "arg" + j),
            (_e += (j !== 0 ? ", " : "") + "arg" + j + "Wired");
        var it = `
        return function (${et}) {
        if (arguments.length !== ${g - 2}) {
          throwBindingError('function ${a} called with ' + arguments.length + ' arguments, expected ${
          g - 2
        }');
        }`;
        h &&
          (it += `var destructors = [];
`);
        var ot = h ? "destructors" : "null",
          st = [
            "throwBindingError",
            "invoker",
            "fn",
            "runDestructors",
            "retType",
            "classParam",
          ],
          nt = [throwBindingError, _, c, runDestructors, s[0], s[1]];
        b &&
          (it +=
            "var thisWired = classParam.toWireType(" +
            ot +
            `, this);
`);
        for (var j = 0; j < g - 2; ++j)
          (it +=
            "var arg" +
            j +
            "Wired = argType" +
            j +
            ".toWireType(" +
            ot +
            ", arg" +
            j +
            "); // " +
            s[j + 2].name +
            `
`),
            st.push("argType" + j),
            nt.push(s[j + 2]);
        if (
          (b && (_e = "thisWired" + (_e.length > 0 ? ", " : "") + _e),
          (it +=
            ($ || d ? "var rv = " : "") +
            "invoker(fn" +
            (_e.length > 0 ? ", " : "") +
            _e +
            `);
`),
          h)
        )
          it += `runDestructors(destructors);
`;
        else
          for (var j = b ? 1 : 2; j < s.length; ++j) {
            var rt = j === 1 ? "thisWired" : "arg" + (j - 2) + "Wired";
            s[j].destructorFunction !== null &&
              ((it +=
                rt +
                "_dtor(" +
                rt +
                "); // " +
                s[j].name +
                `
`),
              st.push(rt + "_dtor"),
              nt.push(s[j].destructorFunction));
          }
        $ &&
          (it += `var ret = retType.fromWireType(rv);
return ret;
`),
          (it += `}
`),
          st.push(it);
        var tt = newFunc(Function, st).apply(null, nt);
        return createNamedFunction(a, tt);
      }
      var ensureOverloadTable = (a, s, o) => {
          if (a[s].overloadTable === void 0) {
            var _ = a[s];
            (a[s] = function () {
              return (
                a[s].overloadTable.hasOwnProperty(arguments.length) ||
                  throwBindingError(
                    `Function '${o}' called with an invalid number of arguments (${arguments.length}) - expects one of (${a[s].overloadTable})!`
                  ),
                a[s].overloadTable[arguments.length].apply(this, arguments)
              );
            }),
              (a[s].overloadTable = []),
              (a[s].overloadTable[_.argCount] = _);
          }
        },
        exposePublicSymbol = (a, s, o) => {
          Module.hasOwnProperty(a)
            ? ((o === void 0 ||
                (Module[a].overloadTable !== void 0 &&
                  Module[a].overloadTable[o] !== void 0)) &&
                throwBindingError(`Cannot register public name '${a}' twice`),
              ensureOverloadTable(Module, a, a),
              Module.hasOwnProperty(o) &&
                throwBindingError(
                  `Cannot register multiple overloads of a function with the same number of arguments (${o})!`
                ),
              (Module[a].overloadTable[o] = s))
            : ((Module[a] = s), o !== void 0 && (Module[a].numArguments = o));
        },
        heap32VectorToArray = (a, s) => {
          for (var o = [], _ = 0; _ < a; _++) o.push(HEAPU32[(s + _ * 4) >> 2]);
          return o;
        },
        replacePublicSymbol = (a, s, o) => {
          Module.hasOwnProperty(a) ||
            throwInternalError("Replacing nonexistant public symbol"),
            Module[a].overloadTable !== void 0 && o !== void 0
              ? (Module[a].overloadTable[o] = s)
              : ((Module[a] = s), (Module[a].argCount = o));
        },
        getDynCaller = (a, s) => {
          var o = [];
          return function () {
            return (
              (o.length = 0), Object.assign(o, arguments), dynCall(a, s, o)
            );
          };
        },
        embind__requireFunction = (a, s) => {
          a = readLatin1String(a);
          function o() {
            return a.includes("j") ? getDynCaller(a, s) : getWasmTableEntry(s);
          }
          var _ = o();
          return (
            typeof _ != "function" &&
              throwBindingError(
                `unknown function pointer with signature ${a}: ${s}`
              ),
            _
          );
        },
        extendError = (a, s) => {
          var o = createNamedFunction(s, function (_) {
            (this.name = s), (this.message = _);
            var c = new Error(_).stack;
            c !== void 0 &&
              (this.stack =
                this.toString() +
                `
` +
                c.replace(/^Error(:[^\n]*)?\n/, ""));
          });
          return (
            (o.prototype = Object.create(a.prototype)),
            (o.prototype.constructor = o),
            (o.prototype.toString = function () {
              return this.message === void 0
                ? this.name
                : `${this.name}: ${this.message}`;
            }),
            o
          );
        },
        UnboundTypeError,
        getTypeName = (a) => {
          var s = ___getTypeName(a),
            o = readLatin1String(s);
          return _free(s), o;
        },
        throwUnboundTypeError = (a, s) => {
          var o = [],
            _ = {};
          function c(d) {
            if (!_[d] && !registeredTypes[d]) {
              if (typeDependencies[d]) {
                typeDependencies[d].forEach(c);
                return;
              }
              o.push(d), (_[d] = !0);
            }
          }
          throw (
            (s.forEach(c),
            new UnboundTypeError(`${a}: ` + o.map(getTypeName).join([", "])))
          );
        },
        getFunctionName = (a) => {
          a = a.trim();
          const s = a.indexOf("(");
          return s !== -1 ? a.substr(0, s) : a;
        },
        __embind_register_function = (a, s, o, _, c, d, g) => {
          var b = heap32VectorToArray(s, o);
          (a = readLatin1String(a)),
            (a = getFunctionName(a)),
            (c = embind__requireFunction(_, c)),
            exposePublicSymbol(
              a,
              function () {
                throwUnboundTypeError(
                  `Cannot call ${a} due to unbound types`,
                  b
                );
              },
              s - 1
            ),
            whenDependentTypesAreResolved([], b, function (h) {
              var j = [h[0], null].concat(h.slice(1));
              return (
                replacePublicSymbol(
                  a,
                  craftInvokerFunction(a, j, null, c, d, g),
                  s - 1
                ),
                []
              );
            });
        };
      __embind_register_function.sig = "vpippppi";
      var integerReadValueFromPointer = (a, s, o) => {
          switch (s) {
            case 1:
              return o ? (_) => HEAP8[_ >> 0] : (_) => HEAPU8[_ >> 0];
            case 2:
              return o ? (_) => HEAP16[_ >> 1] : (_) => HEAPU16[_ >> 1];
            case 4:
              return o ? (_) => HEAP32[_ >> 2] : (_) => HEAPU32[_ >> 2];
            default:
              throw new TypeError(`invalid integer width (${s}): ${a}`);
          }
        },
        __embind_register_integer = (a, s, o, _, c) => {
          s = readLatin1String(s);
          var d = ($) => $;
          if (_ === 0) {
            var g = 32 - 8 * o;
            d = ($) => ($ << g) >>> g;
          }
          var b = s.includes("unsigned"),
            h = ($, et) => {},
            j;
          b
            ? (j = function ($, et) {
                return h(et, this.name), et >>> 0;
              })
            : (j = function ($, et) {
                return h(et, this.name), et;
              }),
            registerType(a, {
              name: s,
              fromWireType: d,
              toWireType: j,
              argPackAdvance: GenericWireTypeSize,
              readValueFromPointer: integerReadValueFromPointer(s, o, _ !== 0),
              destructorFunction: null,
            });
        };
      __embind_register_integer.sig = "vpppii";
      var __embind_register_memory_view = (a, s, o) => {
        var _ = [
            Int8Array,
            Uint8Array,
            Int16Array,
            Uint16Array,
            Int32Array,
            Uint32Array,
            Float32Array,
            Float64Array,
          ],
          c = _[s];
        function d(g) {
          var b = HEAPU32[g >> 2],
            h = HEAPU32[(g + 4) >> 2];
          return new c(HEAP8.buffer, h, b);
        }
        (o = readLatin1String(o)),
          registerType(
            a,
            {
              name: o,
              fromWireType: d,
              argPackAdvance: GenericWireTypeSize,
              readValueFromPointer: d,
            },
            {
              ignoreDuplicateRegistrations: !0,
            }
          );
      };
      __embind_register_memory_view.sig = "vpip";
      function readPointer(a) {
        return this.fromWireType(HEAPU32[a >> 2]);
      }
      var stringToUTF8 = (a, s, o) => stringToUTF8Array(a, HEAPU8, s, o),
        __embind_register_std_string = (a, s) => {
          s = readLatin1String(s);
          var o = s === "std::string";
          registerType(a, {
            name: s,
            fromWireType(_) {
              var c = HEAPU32[_ >> 2],
                d = _ + 4,
                g;
              if (o)
                for (var b = d, h = 0; h <= c; ++h) {
                  var j = d + h;
                  if (h == c || HEAPU8[j] == 0) {
                    var $ = j - b,
                      et = UTF8ToString(b, $);
                    g === void 0 ? (g = et) : ((g += "\0"), (g += et)),
                      (b = j + 1);
                  }
                }
              else {
                for (var _e = new Array(c), h = 0; h < c; ++h)
                  _e[h] = String.fromCharCode(HEAPU8[d + h]);
                g = _e.join("");
              }
              return _free(_), g;
            },
            toWireType(_, c) {
              c instanceof ArrayBuffer && (c = new Uint8Array(c));
              var d,
                g = typeof c == "string";
              g ||
                c instanceof Uint8Array ||
                c instanceof Uint8ClampedArray ||
                c instanceof Int8Array ||
                throwBindingError("Cannot pass non-string to std::string"),
                o && g ? (d = lengthBytesUTF8(c)) : (d = c.length);
              var b = _malloc(4 + d + 1),
                h = b + 4;
              if (((HEAPU32[b >> 2] = d), o && g)) stringToUTF8(c, h, d + 1);
              else if (g)
                for (var j = 0; j < d; ++j) {
                  var $ = c.charCodeAt(j);
                  $ > 255 &&
                    (_free(h),
                    throwBindingError(
                      "String has UTF-16 code units that do not fit in 8 bits"
                    )),
                    (HEAPU8[h + j] = $);
                }
              else for (var j = 0; j < d; ++j) HEAPU8[h + j] = c[j];
              return _ !== null && _.push(_free, b), b;
            },
            argPackAdvance: GenericWireTypeSize,
            readValueFromPointer: readPointer,
            destructorFunction(_) {
              _free(_);
            },
          });
        };
      __embind_register_std_string.sig = "vpp";
      var UTF16Decoder =
          typeof TextDecoder < "u" ? new TextDecoder("utf-16le") : void 0,
        UTF16ToString = (a, s) => {
          for (var o = a, _ = o >> 1, c = _ + s / 2; !(_ >= c) && HEAPU16[_]; )
            ++_;
          if (((o = _ << 1), o - a > 32 && UTF16Decoder))
            return UTF16Decoder.decode(HEAPU8.subarray(a, o));
          for (var d = "", g = 0; !(g >= s / 2); ++g) {
            var b = HEAP16[(a + g * 2) >> 1];
            if (b == 0) break;
            d += String.fromCharCode(b);
          }
          return d;
        },
        stringToUTF16 = (a, s, o) => {
          if ((o === void 0 && (o = 2147483647), o < 2)) return 0;
          o -= 2;
          for (
            var _ = s, c = o < a.length * 2 ? o / 2 : a.length, d = 0;
            d < c;
            ++d
          ) {
            var g = a.charCodeAt(d);
            (HEAP16[s >> 1] = g), (s += 2);
          }
          return (HEAP16[s >> 1] = 0), s - _;
        },
        lengthBytesUTF16 = (a) => a.length * 2,
        UTF32ToString = (a, s) => {
          for (var o = 0, _ = ""; !(o >= s / 4); ) {
            var c = HEAP32[(a + o * 4) >> 2];
            if (c == 0) break;
            if ((++o, c >= 65536)) {
              var d = c - 65536;
              _ += String.fromCharCode(55296 | (d >> 10), 56320 | (d & 1023));
            } else _ += String.fromCharCode(c);
          }
          return _;
        },
        stringToUTF32 = (a, s, o) => {
          if ((o === void 0 && (o = 2147483647), o < 4)) return 0;
          for (var _ = s, c = _ + o - 4, d = 0; d < a.length; ++d) {
            var g = a.charCodeAt(d);
            if (g >= 55296 && g <= 57343) {
              var b = a.charCodeAt(++d);
              g = (65536 + ((g & 1023) << 10)) | (b & 1023);
            }
            if (((HEAP32[s >> 2] = g), (s += 4), s + 4 > c)) break;
          }
          return (HEAP32[s >> 2] = 0), s - _;
        },
        lengthBytesUTF32 = (a) => {
          for (var s = 0, o = 0; o < a.length; ++o) {
            var _ = a.charCodeAt(o);
            _ >= 55296 && _ <= 57343 && ++o, (s += 4);
          }
          return s;
        },
        __embind_register_std_wstring = (a, s, o) => {
          o = readLatin1String(o);
          var _, c, d, g, b;
          s === 2
            ? ((_ = UTF16ToString),
              (c = stringToUTF16),
              (g = lengthBytesUTF16),
              (d = () => HEAPU16),
              (b = 1))
            : s === 4 &&
              ((_ = UTF32ToString),
              (c = stringToUTF32),
              (g = lengthBytesUTF32),
              (d = () => HEAPU32),
              (b = 2)),
            registerType(a, {
              name: o,
              fromWireType: (h) => {
                for (
                  var j = HEAPU32[h >> 2], $ = d(), et, _e = h + 4, it = 0;
                  it <= j;
                  ++it
                ) {
                  var ot = h + 4 + it * s;
                  if (it == j || $[ot >> b] == 0) {
                    var st = ot - _e,
                      nt = _(_e, st);
                    et === void 0 ? (et = nt) : ((et += "\0"), (et += nt)),
                      (_e = ot + s);
                  }
                }
                return _free(h), et;
              },
              toWireType: (h, j) => {
                typeof j != "string" &&
                  throwBindingError(
                    `Cannot pass non-string to C++ string type ${o}`
                  );
                var $ = g(j),
                  et = _malloc(4 + $ + s);
                return (
                  (HEAPU32[et >> 2] = $ >> b),
                  c(j, et + 4, $ + s),
                  h !== null && h.push(_free, et),
                  et
                );
              },
              argPackAdvance: GenericWireTypeSize,
              readValueFromPointer: simpleReadValueFromPointer,
              destructorFunction(h) {
                _free(h);
              },
            });
        };
      __embind_register_std_wstring.sig = "vppp";
      var __embind_register_value_object = (a, s, o, _, c, d) => {
        structRegistrations[a] = {
          name: readLatin1String(s),
          rawConstructor: embind__requireFunction(o, _),
          rawDestructor: embind__requireFunction(c, d),
          fields: [],
        };
      };
      __embind_register_value_object.sig = "vpppppp";
      var __embind_register_value_object_field = (
        a,
        s,
        o,
        _,
        c,
        d,
        g,
        b,
        h,
        j
      ) => {
        structRegistrations[a].fields.push({
          fieldName: readLatin1String(s),
          getterReturnType: o,
          getter: embind__requireFunction(_, c),
          getterContext: d,
          setterArgumentType: g,
          setter: embind__requireFunction(b, h),
          setterContext: j,
        });
      };
      __embind_register_value_object_field.sig = "vpppppppppp";
      var __embind_register_void = (a, s) => {
        (s = readLatin1String(s)),
          registerType(a, {
            isVoid: !0,
            name: s,
            argPackAdvance: 0,
            fromWireType: () => {},
            toWireType: (o, _) => {},
          });
      };
      __embind_register_void.sig = "vpp";
      function __gmtime_js(a, s, o) {
        var _ = convertI32PairToI53Checked(a, s),
          c = new Date(_ * 1e3);
        (HEAP32[o >> 2] = c.getUTCSeconds()),
          (HEAP32[(o + 4) >> 2] = c.getUTCMinutes()),
          (HEAP32[(o + 8) >> 2] = c.getUTCHours()),
          (HEAP32[(o + 12) >> 2] = c.getUTCDate()),
          (HEAP32[(o + 16) >> 2] = c.getUTCMonth()),
          (HEAP32[(o + 20) >> 2] = c.getUTCFullYear() - 1900),
          (HEAP32[(o + 24) >> 2] = c.getUTCDay());
        var d = Date.UTC(c.getUTCFullYear(), 0, 1, 0, 0, 0, 0),
          g = ((c.getTime() - d) / (1e3 * 60 * 60 * 24)) | 0;
        HEAP32[(o + 28) >> 2] = g;
      }
      __gmtime_js.sig = "viip";
      var stringToNewUTF8 = (a) => {
          var s = lengthBytesUTF8(a) + 1,
            o = _malloc(s);
          return o && stringToUTF8(a, o, s), o;
        },
        __tzset_js = (a, s, o) => {
          var _ = new Date().getFullYear(),
            c = new Date(_, 0, 1),
            d = new Date(_, 6, 1),
            g = c.getTimezoneOffset(),
            b = d.getTimezoneOffset(),
            h = Math.max(g, b);
          (HEAPU32[a >> 2] = h * 60), (HEAP32[s >> 2] = +(g != b));
          function j(ot) {
            var st = ot.toTimeString().match(/\(([A-Za-z ]+)\)$/);
            return st ? st[1] : "GMT";
          }
          var $ = j(c),
            et = j(d),
            _e = stringToNewUTF8($),
            it = stringToNewUTF8(et);
          b < g
            ? ((HEAPU32[o >> 2] = _e), (HEAPU32[(o + 4) >> 2] = it))
            : ((HEAPU32[o >> 2] = it), (HEAPU32[(o + 4) >> 2] = _e));
        };
      __tzset_js.sig = "vppp";
      var _abort = () => {
        abort("");
      };
      _abort.sig = "v";
      var _emscripten_date_now = () => Date.now();
      _emscripten_date_now.sig = "d";
      var _emscripten_memcpy_js = (a, s, o) => HEAPU8.copyWithin(a, s, s + o);
      _emscripten_memcpy_js.sig = "vppp";
      var getHeapMax = () => 2147483648,
        growMemory = (a) => {
          var s = wasmMemory.buffer,
            o = (a - s.byteLength + 65535) / 65536;
          try {
            return wasmMemory.grow(o), updateMemoryViews(), 1;
          } catch {}
        },
        _emscripten_resize_heap = (a) => {
          var s = HEAPU8.length;
          a >>>= 0;
          var o = getHeapMax();
          if (a > o) return !1;
          for (
            var _ = (h, j) => h + ((j - (h % j)) % j), c = 1;
            c <= 4;
            c *= 2
          ) {
            var d = s * (1 + 0.2 / c);
            d = Math.min(d, a + 100663296);
            var g = Math.min(o, _(Math.max(a, d), 65536)),
              b = growMemory(g);
            if (b) return !0;
          }
          return !1;
        };
      _emscripten_resize_heap.sig = "ip";
      var ENV = {},
        getExecutableName = () => thisProgram || "./this.program",
        getEnvStrings = () => {
          if (!getEnvStrings.strings) {
            var a =
                (
                  (typeof navigator == "object" &&
                    navigator.languages &&
                    navigator.languages[0]) ||
                  "C"
                ).replace("-", "_") + ".UTF-8",
              s = {
                USER: "web_user",
                LOGNAME: "web_user",
                PATH: "/",
                PWD: "/",
                HOME: "/home/web_user",
                LANG: a,
                _: getExecutableName(),
              };
            for (var o in ENV)
              ENV[o] === void 0 ? delete s[o] : (s[o] = ENV[o]);
            var _ = [];
            for (var o in s) _.push(`${o}=${s[o]}`);
            getEnvStrings.strings = _;
          }
          return getEnvStrings.strings;
        },
        stringToAscii = (a, s) => {
          for (var o = 0; o < a.length; ++o) HEAP8[s++ >> 0] = a.charCodeAt(o);
          HEAP8[s >> 0] = 0;
        },
        _environ_get = (a, s) => {
          var o = 0;
          return (
            getEnvStrings().forEach((_, c) => {
              var d = s + o;
              (HEAPU32[(a + c * 4) >> 2] = d),
                stringToAscii(_, d),
                (o += _.length + 1);
            }),
            0
          );
        };
      _environ_get.sig = "ipp";
      var _environ_sizes_get = (a, s) => {
        var o = getEnvStrings();
        HEAPU32[a >> 2] = o.length;
        var _ = 0;
        return o.forEach((c) => (_ += c.length + 1)), (HEAPU32[s >> 2] = _), 0;
      };
      _environ_sizes_get.sig = "ipp";
      var runtimeKeepaliveCounter = 0,
        keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0,
        _proc_exit = (a) => {
          (EXITSTATUS = a),
            keepRuntimeAlive() ||
              (Module.onExit && Module.onExit(a), (ABORT = !0)),
            quit_(a, new ExitStatus(a));
        };
      _proc_exit.sig = "vi";
      var exitJS = (a, s) => {
          (EXITSTATUS = a), keepRuntimeAlive() || exitRuntime(), _proc_exit(a);
        },
        _exit = exitJS;
      _exit.sig = "vi";
      function _fd_close(a) {
        try {
          var s = SYSCALLS.getStreamFromFD(a);
          return FS.close(s), 0;
        } catch (o) {
          if (typeof FS > "u" || o.name !== "ErrnoError") throw o;
          return o.errno;
        }
      }
      _fd_close.sig = "ii";
      var doReadv = (a, s, o, _) => {
        for (var c = 0, d = 0; d < o; d++) {
          var g = HEAPU32[s >> 2],
            b = HEAPU32[(s + 4) >> 2];
          s += 8;
          var h = FS.read(a, HEAP8, g, b, _);
          if (h < 0) return -1;
          if (((c += h), h < b)) break;
        }
        return c;
      };
      function _fd_read(a, s, o, _) {
        try {
          var c = SYSCALLS.getStreamFromFD(a),
            d = doReadv(c, s, o);
          return (HEAPU32[_ >> 2] = d), 0;
        } catch (g) {
          if (typeof FS > "u" || g.name !== "ErrnoError") throw g;
          return g.errno;
        }
      }
      _fd_read.sig = "iippp";
      function _fd_seek(a, s, o, _, c) {
        var d = convertI32PairToI53Checked(s, o);
        try {
          if (isNaN(d)) return 61;
          var g = SYSCALLS.getStreamFromFD(a);
          return (
            FS.llseek(g, d, _),
            (tempI64 = [
              g.position >>> 0,
              ((tempDouble = g.position),
              +Math.abs(tempDouble) >= 1
                ? tempDouble > 0
                  ? +Math.floor(tempDouble / 4294967296) >>> 0
                  : ~~+Math.ceil(
                      (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
                    ) >>> 0
                : 0),
            ]),
            (HEAP32[c >> 2] = tempI64[0]),
            (HEAP32[(c + 4) >> 2] = tempI64[1]),
            g.getdents && d === 0 && _ === 0 && (g.getdents = null),
            0
          );
        } catch (b) {
          if (typeof FS > "u" || b.name !== "ErrnoError") throw b;
          return b.errno;
        }
      }
      _fd_seek.sig = "iiiiip";
      function _fd_sync(a) {
        try {
          var s = SYSCALLS.getStreamFromFD(a);
          return s.stream_ops && s.stream_ops.fsync ? s.stream_ops.fsync(s) : 0;
        } catch (o) {
          if (typeof FS > "u" || o.name !== "ErrnoError") throw o;
          return o.errno;
        }
      }
      _fd_sync.sig = "ii";
      var doWritev = (a, s, o, _) => {
        for (var c = 0, d = 0; d < o; d++) {
          var g = HEAPU32[s >> 2],
            b = HEAPU32[(s + 4) >> 2];
          s += 8;
          var h = FS.write(a, HEAP8, g, b, _);
          if (h < 0) return -1;
          c += h;
        }
        return c;
      };
      function _fd_write(a, s, o, _) {
        try {
          var c = SYSCALLS.getStreamFromFD(a),
            d = doWritev(c, s, o);
          return (HEAPU32[_ >> 2] = d), 0;
        } catch (g) {
          if (typeof FS > "u" || g.name !== "ErrnoError") throw g;
          return g.errno;
        }
      }
      _fd_write.sig = "iippp";
      function _g721_decoder() {
        return wasmImports.g721_decoder.apply(null, arguments);
      }
      _g721_decoder.stub = !0;
      function _g721_encoder() {
        return wasmImports.g721_encoder.apply(null, arguments);
      }
      _g721_encoder.stub = !0;
      function _g723_16_decoder() {
        return wasmImports.g723_16_decoder.apply(null, arguments);
      }
      _g723_16_decoder.stub = !0;
      function _g723_16_encoder() {
        return wasmImports.g723_16_encoder.apply(null, arguments);
      }
      _g723_16_encoder.stub = !0;
      function _g723_24_decoder() {
        return wasmImports.g723_24_decoder.apply(null, arguments);
      }
      _g723_24_decoder.stub = !0;
      function _g723_24_encoder() {
        return wasmImports.g723_24_encoder.apply(null, arguments);
      }
      _g723_24_encoder.stub = !0;
      function _g723_40_decoder() {
        return wasmImports.g723_40_decoder.apply(null, arguments);
      }
      _g723_40_decoder.stub = !0;
      function _g723_40_encoder() {
        return wasmImports.g723_40_encoder.apply(null, arguments);
      }
      _g723_40_encoder.stub = !0;
      function _gsm_DLB() {
        return wasmImports.gsm_DLB.apply(null, arguments);
      }
      _gsm_DLB.stub = !0;
      function _gsm_FAC() {
        return wasmImports.gsm_FAC.apply(null, arguments);
      }
      _gsm_FAC.stub = !0;
      function _gsm_NRFAC() {
        return wasmImports.gsm_NRFAC.apply(null, arguments);
      }
      _gsm_NRFAC.stub = !0;
      function _gsm_QLB() {
        return wasmImports.gsm_QLB.apply(null, arguments);
      }
      _gsm_QLB.stub = !0;
      function _psf_d2i_array() {
        return wasmImports.psf_d2i_array.apply(null, arguments);
      }
      _psf_d2i_array.stub = !0;
      function _psf_d2i_clip_array() {
        return wasmImports.psf_d2i_clip_array.apply(null, arguments);
      }
      _psf_d2i_clip_array.stub = !0;
      function _psf_default_seek() {
        return wasmImports.psf_default_seek.apply(null, arguments);
      }
      _psf_default_seek.stub = !0;
      function _psf_f2i_array() {
        return wasmImports.psf_f2i_array.apply(null, arguments);
      }
      _psf_f2i_array.stub = !0;
      function _psf_f2i_clip_array() {
        return wasmImports.psf_f2i_clip_array.apply(null, arguments);
      }
      _psf_f2i_clip_array.stub = !0;
      function _sf_close() {
        return wasmImports.sf_close.apply(null, arguments);
      }
      _sf_close.stub = !0;
      function _sf_command() {
        return wasmImports.sf_command.apply(null, arguments);
      }
      _sf_command.stub = !0;
      function _sf_errno() {
        return wasmImports.sf_errno.apply(null, arguments);
      }
      _sf_errno.stub = !0;
      function _sf_format_check() {
        return wasmImports.sf_format_check.apply(null, arguments);
      }
      _sf_format_check.stub = !0;
      function _sf_get_chunk_data() {
        return wasmImports.sf_get_chunk_data.apply(null, arguments);
      }
      _sf_get_chunk_data.stub = !0;
      function _sf_get_chunk_iterator() {
        return wasmImports.sf_get_chunk_iterator.apply(null, arguments);
      }
      _sf_get_chunk_iterator.stub = !0;
      function _sf_get_chunk_size() {
        return wasmImports.sf_get_chunk_size.apply(null, arguments);
      }
      _sf_get_chunk_size.stub = !0;
      function _sf_open() {
        return wasmImports.sf_open.apply(null, arguments);
      }
      _sf_open.stub = !0;
      function _sf_readf_float() {
        return wasmImports.sf_readf_float.apply(null, arguments);
      }
      _sf_readf_float.stub = !0;
      function _sf_seek() {
        return wasmImports.sf_seek.apply(null, arguments);
      }
      _sf_seek.stub = !0;
      function _sf_set_chunk() {
        return wasmImports.sf_set_chunk.apply(null, arguments);
      }
      _sf_set_chunk.stub = !0;
      function _sf_write_raw() {
        return wasmImports.sf_write_raw.apply(null, arguments);
      }
      _sf_write_raw.stub = !0;
      function _sf_writef_float() {
        return wasmImports.sf_writef_float.apply(null, arguments);
      }
      _sf_writef_float.stub = !0;
      function _src_delete() {
        return wasmImports.src_delete.apply(null, arguments);
      }
      _src_delete.stub = !0;
      function _src_is_valid_ratio() {
        return wasmImports.src_is_valid_ratio.apply(null, arguments);
      }
      _src_is_valid_ratio.stub = !0;
      function _src_new() {
        return wasmImports.src_new.apply(null, arguments);
      }
      _src_new.stub = !0;
      function _src_process() {
        return wasmImports.src_process.apply(null, arguments);
      }
      _src_process.stub = !0;
      function _src_strerror() {
        return wasmImports.src_strerror.apply(null, arguments);
      }
      _src_strerror.stub = !0;
      var isLeapYear = (a) => a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0),
        arraySum = (a, s) => {
          for (var o = 0, _ = 0; _ <= s; o += a[_++]);
          return o;
        },
        MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
        MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
        addDays = (a, s) => {
          for (var o = new Date(a.getTime()); s > 0; ) {
            var _ = isLeapYear(o.getFullYear()),
              c = o.getMonth(),
              d = (_ ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[c];
            if (s > d - o.getDate())
              (s -= d - o.getDate() + 1),
                o.setDate(1),
                c < 11
                  ? o.setMonth(c + 1)
                  : (o.setMonth(0), o.setFullYear(o.getFullYear() + 1));
            else return o.setDate(o.getDate() + s), o;
          }
          return o;
        },
        writeArrayToMemory = (a, s) => {
          HEAP8.set(a, s);
        },
        _strftime = (a, s, o, _) => {
          var c = HEAPU32[(_ + 40) >> 2],
            d = {
              tm_sec: HEAP32[_ >> 2],
              tm_min: HEAP32[(_ + 4) >> 2],
              tm_hour: HEAP32[(_ + 8) >> 2],
              tm_mday: HEAP32[(_ + 12) >> 2],
              tm_mon: HEAP32[(_ + 16) >> 2],
              tm_year: HEAP32[(_ + 20) >> 2],
              tm_wday: HEAP32[(_ + 24) >> 2],
              tm_yday: HEAP32[(_ + 28) >> 2],
              tm_isdst: HEAP32[(_ + 32) >> 2],
              tm_gmtoff: HEAP32[(_ + 36) >> 2],
              tm_zone: c ? UTF8ToString(c) : "",
            },
            g = UTF8ToString(o),
            b = {
              "%c": "%a %b %d %H:%M:%S %Y",
              "%D": "%m/%d/%y",
              "%F": "%Y-%m-%d",
              "%h": "%b",
              "%r": "%I:%M:%S %p",
              "%R": "%H:%M",
              "%T": "%H:%M:%S",
              "%x": "%m/%d/%y",
              "%X": "%H:%M:%S",
              "%Ec": "%c",
              "%EC": "%C",
              "%Ex": "%m/%d/%y",
              "%EX": "%H:%M:%S",
              "%Ey": "%y",
              "%EY": "%Y",
              "%Od": "%d",
              "%Oe": "%e",
              "%OH": "%H",
              "%OI": "%I",
              "%Om": "%m",
              "%OM": "%M",
              "%OS": "%S",
              "%Ou": "%u",
              "%OU": "%U",
              "%OV": "%V",
              "%Ow": "%w",
              "%OW": "%W",
              "%Oy": "%y",
            };
          for (var h in b) g = g.replace(new RegExp(h, "g"), b[h]);
          var j = [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ],
            $ = [
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ];
          function et(tt, at, Et) {
            for (
              var lt = typeof tt == "number" ? tt.toString() : tt || "";
              lt.length < at;

            )
              lt = Et[0] + lt;
            return lt;
          }
          function _e(tt, at) {
            return et(tt, at, "0");
          }
          function it(tt, at) {
            function Et(_t) {
              return _t < 0 ? -1 : _t > 0 ? 1 : 0;
            }
            var lt;
            return (
              (lt = Et(tt.getFullYear() - at.getFullYear())) === 0 &&
                (lt = Et(tt.getMonth() - at.getMonth())) === 0 &&
                (lt = Et(tt.getDate() - at.getDate())),
              lt
            );
          }
          function ot(tt) {
            switch (tt.getDay()) {
              case 0:
                return new Date(tt.getFullYear() - 1, 11, 29);
              case 1:
                return tt;
              case 2:
                return new Date(tt.getFullYear(), 0, 3);
              case 3:
                return new Date(tt.getFullYear(), 0, 2);
              case 4:
                return new Date(tt.getFullYear(), 0, 1);
              case 5:
                return new Date(tt.getFullYear() - 1, 11, 31);
              case 6:
                return new Date(tt.getFullYear() - 1, 11, 30);
            }
          }
          function st(tt) {
            var at = addDays(new Date(tt.tm_year + 1900, 0, 1), tt.tm_yday),
              Et = new Date(at.getFullYear(), 0, 4),
              lt = new Date(at.getFullYear() + 1, 0, 4),
              _t = ot(Et),
              ut = ot(lt);
            return it(_t, at) <= 0
              ? it(ut, at) <= 0
                ? at.getFullYear() + 1
                : at.getFullYear()
              : at.getFullYear() - 1;
          }
          var nt = {
            "%a": (tt) => j[tt.tm_wday].substring(0, 3),
            "%A": (tt) => j[tt.tm_wday],
            "%b": (tt) => $[tt.tm_mon].substring(0, 3),
            "%B": (tt) => $[tt.tm_mon],
            "%C": (tt) => {
              var at = tt.tm_year + 1900;
              return _e((at / 100) | 0, 2);
            },
            "%d": (tt) => _e(tt.tm_mday, 2),
            "%e": (tt) => et(tt.tm_mday, 2, " "),
            "%g": (tt) => st(tt).toString().substring(2),
            "%G": (tt) => st(tt),
            "%H": (tt) => _e(tt.tm_hour, 2),
            "%I": (tt) => {
              var at = tt.tm_hour;
              return at == 0 ? (at = 12) : at > 12 && (at -= 12), _e(at, 2);
            },
            "%j": (tt) =>
              _e(
                tt.tm_mday +
                  arraySum(
                    isLeapYear(tt.tm_year + 1900)
                      ? MONTH_DAYS_LEAP
                      : MONTH_DAYS_REGULAR,
                    tt.tm_mon - 1
                  ),
                3
              ),
            "%m": (tt) => _e(tt.tm_mon + 1, 2),
            "%M": (tt) => _e(tt.tm_min, 2),
            "%n": () => `
`,
            "%p": (tt) => (tt.tm_hour >= 0 && tt.tm_hour < 12 ? "AM" : "PM"),
            "%S": (tt) => _e(tt.tm_sec, 2),
            "%t": () => "	",
            "%u": (tt) => tt.tm_wday || 7,
            "%U": (tt) => {
              var at = tt.tm_yday + 7 - tt.tm_wday;
              return _e(Math.floor(at / 7), 2);
            },
            "%V": (tt) => {
              var at = Math.floor(
                (tt.tm_yday + 7 - ((tt.tm_wday + 6) % 7)) / 7
              );
              if (((tt.tm_wday + 371 - tt.tm_yday - 2) % 7 <= 2 && at++, at)) {
                if (at == 53) {
                  var lt = (tt.tm_wday + 371 - tt.tm_yday) % 7;
                  lt != 4 && (lt != 3 || !isLeapYear(tt.tm_year)) && (at = 1);
                }
              } else {
                at = 52;
                var Et = (tt.tm_wday + 7 - tt.tm_yday - 1) % 7;
                (Et == 4 || (Et == 5 && isLeapYear((tt.tm_year % 400) - 1))) &&
                  at++;
              }
              return _e(at, 2);
            },
            "%w": (tt) => tt.tm_wday,
            "%W": (tt) => {
              var at = tt.tm_yday + 7 - ((tt.tm_wday + 6) % 7);
              return _e(Math.floor(at / 7), 2);
            },
            "%y": (tt) => (tt.tm_year + 1900).toString().substring(2),
            "%Y": (tt) => tt.tm_year + 1900,
            "%z": (tt) => {
              var at = tt.tm_gmtoff,
                Et = at >= 0;
              return (
                (at = Math.abs(at) / 60),
                (at = (at / 60) * 100 + (at % 60)),
                (Et ? "+" : "-") + ("0000" + at).slice(-4)
              );
            },
            "%Z": (tt) => tt.tm_zone,
            "%%": () => "%",
          };
          g = g.replace(/%%/g, "\0\0");
          for (var h in nt)
            g.includes(h) && (g = g.replace(new RegExp(h, "g"), nt[h](d)));
          g = g.replace(/\0\0/g, "%");
          var rt = intArrayFromString(g, !1);
          return rt.length > s ? 0 : (writeArrayToMemory(rt, a), rt.length - 1);
        };
      _strftime.sig = "ppppp";
      var _strftime_l = (a, s, o, _, c) => _strftime(a, s, o, _);
      _strftime_l.sig = "pppppp";
      function _taglib_audioproperties_bitrate() {
        return wasmImports.taglib_audioproperties_bitrate.apply(
          null,
          arguments
        );
      }
      _taglib_audioproperties_bitrate.stub = !0;
      function _taglib_audioproperties_channels() {
        return wasmImports.taglib_audioproperties_channels.apply(
          null,
          arguments
        );
      }
      _taglib_audioproperties_channels.stub = !0;
      function _taglib_audioproperties_length() {
        return wasmImports.taglib_audioproperties_length.apply(null, arguments);
      }
      _taglib_audioproperties_length.stub = !0;
      function _taglib_audioproperties_samplerate() {
        return wasmImports.taglib_audioproperties_samplerate.apply(
          null,
          arguments
        );
      }
      _taglib_audioproperties_samplerate.stub = !0;
      function _taglib_file_audioproperties() {
        return wasmImports.taglib_file_audioproperties.apply(null, arguments);
      }
      _taglib_file_audioproperties.stub = !0;
      function _taglib_file_free() {
        return wasmImports.taglib_file_free.apply(null, arguments);
      }
      _taglib_file_free.stub = !0;
      function _taglib_file_new() {
        return wasmImports.taglib_file_new.apply(null, arguments);
      }
      _taglib_file_new.stub = !0;
      function _taglib_tag_free_strings() {
        return wasmImports.taglib_tag_free_strings.apply(null, arguments);
      }
      _taglib_tag_free_strings.stub = !0;
      var handleException = (a) => {
          if (a instanceof ExitStatus || a == "unwind") return EXITSTATUS;
          quit_(1, a);
        },
        stringToUTF8OnStack = (a) => {
          var s = lengthBytesUTF8(a) + 1,
            o = stackAlloc(s);
          return stringToUTF8(a, o, s), o;
        },
        getCFunc = (a) => {
          var s = Module["_" + a];
          return s;
        },
        ccall = (a, s, o, _, c) => {
          var d = {
            string: (ot) => {
              var st = 0;
              return (
                ot != null && ot !== 0 && (st = stringToUTF8OnStack(ot)), st
              );
            },
            array: (ot) => {
              var st = stackAlloc(ot.length);
              return writeArrayToMemory(ot, st), st;
            },
          };
          function g(ot) {
            return s === "string"
              ? UTF8ToString(ot)
              : s === "boolean"
              ? !!ot
              : ot;
          }
          var b = getCFunc(a),
            h = [],
            j = 0;
          if (_)
            for (var $ = 0; $ < _.length; $++) {
              var et = d[o[$]];
              et
                ? (j === 0 && (j = stackSave()), (h[$] = et(_[$])))
                : (h[$] = _[$]);
            }
          var _e = b.apply(null, h);
          function it(ot) {
            return j !== 0 && stackRestore(j), g(ot);
          }
          return (_e = it(_e)), _e;
        },
        cwrap = (a, s, o, _) => {
          var c = !o || o.every((g) => g === "number" || g === "boolean"),
            d = s !== "string";
          return d && c && !_
            ? getCFunc(a)
            : function () {
                return ccall(a, s, o, arguments);
              };
        };
      registerWasmPlugin();
      var FSNode = function (a, s, o, _) {
          a || (a = this),
            (this.parent = a),
            (this.mount = a.mount),
            (this.mounted = null),
            (this.id = FS.nextInode++),
            (this.name = s),
            (this.mode = o),
            (this.node_ops = {}),
            (this.stream_ops = {}),
            (this.rdev = _);
        },
        readMode = 365,
        writeMode = 146;
      Object.defineProperties(FSNode.prototype, {
        read: {
          get: function () {
            return (this.mode & readMode) === readMode;
          },
          set: function (a) {
            a ? (this.mode |= readMode) : (this.mode &= ~readMode);
          },
        },
        write: {
          get: function () {
            return (this.mode & writeMode) === writeMode;
          },
          set: function (a) {
            a ? (this.mode |= writeMode) : (this.mode &= ~writeMode);
          },
        },
        isFolder: {
          get: function () {
            return FS.isDir(this.mode);
          },
        },
        isDevice: {
          get: function () {
            return FS.isChrdev(this.mode);
          },
        },
      }),
        (FS.FSNode = FSNode),
        (FS.createPreloadedFile = FS_createPreloadedFile),
        FS.staticInit(),
        (Module.FS_createPath = FS.createPath),
        (Module.FS_createDataFile = FS.createDataFile),
        (Module.FS_createPreloadedFile = FS.createPreloadedFile),
        (Module.FS_unlink = FS.unlink),
        (Module.FS_createLazyFile = FS.createLazyFile),
        (Module.FS_createDevice = FS.createDevice),
        (InternalError = Module.InternalError =
          class extends Error {
            constructor(s) {
              super(s), (this.name = "InternalError");
            }
          }),
        embind_init_charCodes(),
        (BindingError = Module.BindingError =
          class extends Error {
            constructor(s) {
              super(s), (this.name = "BindingError");
            }
          }),
        handleAllocatorInit(),
        init_emval(),
        (UnboundTypeError = Module.UnboundTypeError =
          extendError(Error, "UnboundTypeError"));
      var wasmImports = {
          _ZN4utf812invalid_utf8D0Ev: __ZN4utf812invalid_utf8D0Ev,
          _ZN4utf813invalid_utf16D0Ev: __ZN4utf813invalid_utf16D0Ev,
          _ZN4utf815not_enough_roomD0Ev: __ZN4utf815not_enough_roomD0Ev,
          _ZN4utf818invalid_code_pointD0Ev: __ZN4utf818invalid_code_pointD0Ev,
          _ZN4utf84nextIPKcEEjRT_S3_: __ZN4utf84nextIPKcEEjRT_S3_,
          _ZN4utf86appendINSt3__211__wrap_iterIPcEEEET_jS5_:
            __ZN4utf86appendINSt3__211__wrap_iterIPcEEEET_jS5_,
          _ZN4utf88internal13validate_nextIPKcEENS0_9utf_errorERT_S5_Rj:
            __ZN4utf88internal13validate_nextIPKcEENS0_9utf_errorERT_S5_Rj,
          _ZN4utf88utf16to8INSt3__211__wrap_iterIPKwEENS2_IPcEEEET0_T_S9_S8_:
            __ZN4utf88utf16to8INSt3__211__wrap_iterIPKwEENS2_IPcEEEET0_T_S9_S8_,
          _ZN6TagLib10ByteVectorC1EPKcj: __ZN6TagLib10ByteVectorC1EPKcj,
          _ZN6TagLib10ByteVectorD1Ev: __ZN6TagLib10ByteVectorD1Ev,
          _ZN6TagLib10FileStream10writeBlockERKNS_10ByteVectorE:
            __ZN6TagLib10FileStream10writeBlockERKNS_10ByteVectorE,
          _ZN6TagLib10FileStream11removeBlockExm:
            __ZN6TagLib10FileStream11removeBlockExm,
          _ZN6TagLib10FileStream4seekExNS_8IOStream8PositionE:
            __ZN6TagLib10FileStream4seekExNS_8IOStream8PositionE,
          _ZN6TagLib10FileStream5clearEv: __ZN6TagLib10FileStream5clearEv,
          _ZN6TagLib10FileStream6insertERKNS_10ByteVectorExm:
            __ZN6TagLib10FileStream6insertERKNS_10ByteVectorExm,
          _ZN6TagLib10FileStream6lengthEv: __ZN6TagLib10FileStream6lengthEv,
          _ZN6TagLib10FileStream8truncateEx: __ZN6TagLib10FileStream8truncateEx,
          _ZN6TagLib10FileStream9readBlockEm:
            __ZN6TagLib10FileStream9readBlockEm,
          _ZN6TagLib10FileStreamD0Ev: __ZN6TagLib10FileStreamD0Ev,
          _ZN6TagLib10FileStreamD1Ev: __ZN6TagLib10FileStreamD1Ev,
          _ZN6TagLib10StringList6appendERKNS_6StringE:
            __ZN6TagLib10StringList6appendERKNS_6StringE,
          _ZN6TagLib10StringListC1ERKNS_6StringE:
            __ZN6TagLib10StringListC1ERKNS_6StringE,
          _ZN6TagLib10StringListC1ERKS0_: __ZN6TagLib10StringListC1ERKS0_,
          _ZN6TagLib10StringListC1Ev: __ZN6TagLib10StringListC1Ev,
          _ZN6TagLib10StringListD1Ev: __ZN6TagLib10StringListD1Ev,
          _ZN6TagLib10StringListaSERKS0_: __ZN6TagLib10StringListaSERKS0_,
          _ZN6TagLib11PropertyMap4findERKNS_6StringE:
            __ZN6TagLib11PropertyMap4findERKNS_6StringE,
          _ZN6TagLib11PropertyMap5eraseERKNS_6StringE:
            __ZN6TagLib11PropertyMap5eraseERKNS_6StringE,
          _ZN6TagLib11PropertyMap6insertERKNS_6StringERKNS_10StringListE:
            __ZN6TagLib11PropertyMap6insertERKNS_6StringERKNS_10StringListE,
          _ZN6TagLib11PropertyMapD1Ev: __ZN6TagLib11PropertyMapD1Ev,
          _ZN6TagLib13DebugListenerD0Ev: __ZN6TagLib13DebugListenerD0Ev,
          _ZN6TagLib13DebugListenerD1Ev: __ZN6TagLib13DebugListenerD1Ev,
          _ZN6TagLib13DebugListenerD2Ev: __ZN6TagLib13DebugListenerD2Ev,
          _ZN6TagLib13debugListenerE: __ZN6TagLib13debugListenerE,
          _ZN6TagLib15AudioPropertiesD0Ev: __ZN6TagLib15AudioPropertiesD0Ev,
          _ZN6TagLib15AudioPropertiesD1Ev: __ZN6TagLib15AudioPropertiesD1Ev,
          _ZN6TagLib16ByteVectorStream10writeBlockERKNS_10ByteVectorE:
            __ZN6TagLib16ByteVectorStream10writeBlockERKNS_10ByteVectorE,
          _ZN6TagLib16ByteVectorStream11removeBlockExm:
            __ZN6TagLib16ByteVectorStream11removeBlockExm,
          _ZN6TagLib16ByteVectorStream4seekExNS_8IOStream8PositionE:
            __ZN6TagLib16ByteVectorStream4seekExNS_8IOStream8PositionE,
          _ZN6TagLib16ByteVectorStream5clearEv:
            __ZN6TagLib16ByteVectorStream5clearEv,
          _ZN6TagLib16ByteVectorStream6insertERKNS_10ByteVectorExm:
            __ZN6TagLib16ByteVectorStream6insertERKNS_10ByteVectorExm,
          _ZN6TagLib16ByteVectorStream6lengthEv:
            __ZN6TagLib16ByteVectorStream6lengthEv,
          _ZN6TagLib16ByteVectorStream8truncateEx:
            __ZN6TagLib16ByteVectorStream8truncateEx,
          _ZN6TagLib16ByteVectorStream9readBlockEm:
            __ZN6TagLib16ByteVectorStream9readBlockEm,
          _ZN6TagLib16ByteVectorStreamC1ERKNS_10ByteVectorE:
            __ZN6TagLib16ByteVectorStreamC1ERKNS_10ByteVectorE,
          _ZN6TagLib16ByteVectorStreamD0Ev: __ZN6TagLib16ByteVectorStreamD0Ev,
          _ZN6TagLib16ByteVectorStreamD1Ev: __ZN6TagLib16ByteVectorStreamD1Ev,
          _ZN6TagLib2IT10PropertiesD0Ev: __ZN6TagLib2IT10PropertiesD0Ev,
          _ZN6TagLib2IT10PropertiesD1Ev: __ZN6TagLib2IT10PropertiesD1Ev,
          _ZN6TagLib2IT4File4saveEv: __ZN6TagLib2IT4File4saveEv,
          _ZN6TagLib2IT4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib2IT4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib2IT4FileD0Ev: __ZN6TagLib2IT4FileD0Ev,
          _ZN6TagLib2IT4FileD1Ev: __ZN6TagLib2IT4FileD1Ev,
          _ZN6TagLib2XM10PropertiesD0Ev: __ZN6TagLib2XM10PropertiesD0Ev,
          _ZN6TagLib2XM10PropertiesD1Ev: __ZN6TagLib2XM10PropertiesD1Ev,
          _ZN6TagLib2XM4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib2XM4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib2XM4File4saveEv: __ZN6TagLib2XM4File4saveEv,
          _ZN6TagLib2XM4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib2XM4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib2XM4FileD0Ev: __ZN6TagLib2XM4FileD0Ev,
          _ZN6TagLib2XM4FileD1Ev: __ZN6TagLib2XM4FileD1Ev,
          _ZN6TagLib3APE10PropertiesD0Ev: __ZN6TagLib3APE10PropertiesD0Ev,
          _ZN6TagLib3APE10PropertiesD1Ev: __ZN6TagLib3APE10PropertiesD1Ev,
          _ZN6TagLib3APE3Tag10setCommentERKNS_6StringE:
            __ZN6TagLib3APE3Tag10setCommentERKNS_6StringE,
          _ZN6TagLib3APE3Tag13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3APE3Tag13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3APE3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE:
            __ZN6TagLib3APE3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE,
          _ZN6TagLib3APE3Tag27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib3APE3Tag27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib3APE3Tag7setYearEj: __ZN6TagLib3APE3Tag7setYearEj,
          _ZN6TagLib3APE3Tag8setAlbumERKNS_6StringE:
            __ZN6TagLib3APE3Tag8setAlbumERKNS_6StringE,
          _ZN6TagLib3APE3Tag8setGenreERKNS_6StringE:
            __ZN6TagLib3APE3Tag8setGenreERKNS_6StringE,
          _ZN6TagLib3APE3Tag8setTitleERKNS_6StringE:
            __ZN6TagLib3APE3Tag8setTitleERKNS_6StringE,
          _ZN6TagLib3APE3Tag8setTrackEj: __ZN6TagLib3APE3Tag8setTrackEj,
          _ZN6TagLib3APE3Tag9setArtistERKNS_6StringE:
            __ZN6TagLib3APE3Tag9setArtistERKNS_6StringE,
          _ZN6TagLib3APE3TagD0Ev: __ZN6TagLib3APE3TagD0Ev,
          _ZN6TagLib3APE3TagD1Ev: __ZN6TagLib3APE3TagD1Ev,
          _ZN6TagLib3APE4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3APE4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3APE4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib3APE4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib3APE4File4saveEv: __ZN6TagLib3APE4File4saveEv,
          _ZN6TagLib3APE4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib3APE4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib3APE4FileD0Ev: __ZN6TagLib3APE4FileD0Ev,
          _ZN6TagLib3APE4FileD1Ev: __ZN6TagLib3APE4FileD1Ev,
          _ZN6TagLib3APE4ItemD0Ev: __ZN6TagLib3APE4ItemD0Ev,
          _ZN6TagLib3APE4ItemD1Ev: __ZN6TagLib3APE4ItemD1Ev,
          _ZN6TagLib3APE6FooterD0Ev: __ZN6TagLib3APE6FooterD0Ev,
          _ZN6TagLib3APE6FooterD1Ev: __ZN6TagLib3APE6FooterD1Ev,
          _ZN6TagLib3ASF10PropertiesD0Ev: __ZN6TagLib3ASF10PropertiesD0Ev,
          _ZN6TagLib3ASF10PropertiesD1Ev: __ZN6TagLib3ASF10PropertiesD1Ev,
          _ZN6TagLib3ASF3Tag10setCommentERKNS_6StringE:
            __ZN6TagLib3ASF3Tag10setCommentERKNS_6StringE,
          _ZN6TagLib3ASF3Tag12setCopyrightERKNS_6StringE:
            __ZN6TagLib3ASF3Tag12setCopyrightERKNS_6StringE,
          _ZN6TagLib3ASF3Tag13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3ASF3Tag13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3ASF3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE:
            __ZN6TagLib3ASF3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE,
          _ZN6TagLib3ASF3Tag27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib3ASF3Tag27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib3ASF3Tag7setYearEj: __ZN6TagLib3ASF3Tag7setYearEj,
          _ZN6TagLib3ASF3Tag8setAlbumERKNS_6StringE:
            __ZN6TagLib3ASF3Tag8setAlbumERKNS_6StringE,
          _ZN6TagLib3ASF3Tag8setGenreERKNS_6StringE:
            __ZN6TagLib3ASF3Tag8setGenreERKNS_6StringE,
          _ZN6TagLib3ASF3Tag8setTitleERKNS_6StringE:
            __ZN6TagLib3ASF3Tag8setTitleERKNS_6StringE,
          _ZN6TagLib3ASF3Tag8setTrackEj: __ZN6TagLib3ASF3Tag8setTrackEj,
          _ZN6TagLib3ASF3Tag9setArtistERKNS_6StringE:
            __ZN6TagLib3ASF3Tag9setArtistERKNS_6StringE,
          _ZN6TagLib3ASF3Tag9setRatingERKNS_6StringE:
            __ZN6TagLib3ASF3Tag9setRatingERKNS_6StringE,
          _ZN6TagLib3ASF3TagD0Ev: __ZN6TagLib3ASF3TagD0Ev,
          _ZN6TagLib3ASF3TagD1Ev: __ZN6TagLib3ASF3TagD1Ev,
          _ZN6TagLib3ASF4File11FilePrivate10BaseObject5parseEPS1_x:
            __ZN6TagLib3ASF4File11FilePrivate10BaseObject5parseEPS1_x,
          _ZN6TagLib3ASF4File11FilePrivate10BaseObject6renderEPS1_:
            __ZN6TagLib3ASF4File11FilePrivate10BaseObject6renderEPS1_,
          _ZN6TagLib3ASF4File11FilePrivate10BaseObjectD0Ev:
            __ZN6TagLib3ASF4File11FilePrivate10BaseObjectD0Ev,
          _ZN6TagLib3ASF4File11FilePrivate10BaseObjectD2Ev:
            __ZN6TagLib3ASF4File11FilePrivate10BaseObjectD2Ev,
          _ZN6TagLib3ASF4File11FilePrivate13UnknownObjectD0Ev:
            __ZN6TagLib3ASF4File11FilePrivate13UnknownObjectD0Ev,
          _ZN6TagLib3ASF4File11FilePrivate13UnknownObjectD2Ev:
            __ZN6TagLib3ASF4File11FilePrivate13UnknownObjectD2Ev,
          _ZN6TagLib3ASF4File11FilePrivate14MetadataObject5parseEPS1_x:
            __ZN6TagLib3ASF4File11FilePrivate14MetadataObject5parseEPS1_x,
          _ZN6TagLib3ASF4File11FilePrivate14MetadataObject6renderEPS1_:
            __ZN6TagLib3ASF4File11FilePrivate14MetadataObject6renderEPS1_,
          _ZN6TagLib3ASF4File11FilePrivate14MetadataObjectD0Ev:
            __ZN6TagLib3ASF4File11FilePrivate14MetadataObjectD0Ev,
          _ZN6TagLib3ASF4File11FilePrivate14MetadataObjectD2Ev:
            __ZN6TagLib3ASF4File11FilePrivate14MetadataObjectD2Ev,
          _ZN6TagLib3ASF4File11FilePrivate15CodecListObject5parseEPS1_x:
            __ZN6TagLib3ASF4File11FilePrivate15CodecListObject5parseEPS1_x,
          _ZN6TagLib3ASF4File11FilePrivate15CodecListObjectD0Ev:
            __ZN6TagLib3ASF4File11FilePrivate15CodecListObjectD0Ev,
          _ZN6TagLib3ASF4File11FilePrivate20FilePropertiesObject5parseEPS1_x:
            __ZN6TagLib3ASF4File11FilePrivate20FilePropertiesObject5parseEPS1_x,
          _ZN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectD0Ev:
            __ZN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectD0Ev,
          _ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObject5parseEPS1_x:
            __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObject5parseEPS1_x,
          _ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObject6renderEPS1_:
            __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObject6renderEPS1_,
          _ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectD0Ev:
            __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectD0Ev,
          _ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectD2Ev:
            __ZN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectD2Ev,
          _ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObject5parseEPS1_x:
            __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObject5parseEPS1_x,
          _ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObject6renderEPS1_:
            __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObject6renderEPS1_,
          _ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectD0Ev:
            __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectD0Ev,
          _ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectD2Ev:
            __ZN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectD2Ev,
          _ZN6TagLib3ASF4File11FilePrivate22StreamPropertiesObject5parseEPS1_x:
            __ZN6TagLib3ASF4File11FilePrivate22StreamPropertiesObject5parseEPS1_x,
          _ZN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectD0Ev:
            __ZN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectD0Ev,
          _ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObject5parseEPS1_x:
            __ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObject5parseEPS1_x,
          _ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObject6renderEPS1_:
            __ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObject6renderEPS1_,
          _ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectD0Ev:
            __ZN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectD0Ev,
          _ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject5parseEPS1_x:
            __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject5parseEPS1_x,
          _ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject6renderEPS1_:
            __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject6renderEPS1_,
          _ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectD0Ev:
            __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectD0Ev,
          _ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectD2Ev:
            __ZN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectD2Ev,
          _ZN6TagLib3ASF4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3ASF4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3ASF4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib3ASF4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib3ASF4File4saveEv: __ZN6TagLib3ASF4File4saveEv,
          _ZN6TagLib3ASF4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib3ASF4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib3ASF4FileD0Ev: __ZN6TagLib3ASF4FileD0Ev,
          _ZN6TagLib3ASF4FileD1Ev: __ZN6TagLib3ASF4FileD1Ev,
          _ZN6TagLib3ASF7PictureD0Ev: __ZN6TagLib3ASF7PictureD0Ev,
          _ZN6TagLib3ASF7PictureD1Ev: __ZN6TagLib3ASF7PictureD1Ev,
          _ZN6TagLib3ASF9AttributeD0Ev: __ZN6TagLib3ASF9AttributeD0Ev,
          _ZN6TagLib3ASF9AttributeD1Ev: __ZN6TagLib3ASF9AttributeD1Ev,
          _ZN6TagLib3DSF10PropertiesD0Ev: __ZN6TagLib3DSF10PropertiesD0Ev,
          _ZN6TagLib3DSF10PropertiesD1Ev: __ZN6TagLib3DSF10PropertiesD1Ev,
          _ZN6TagLib3DSF4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3DSF4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3DSF4File4saveEv: __ZN6TagLib3DSF4File4saveEv,
          _ZN6TagLib3DSF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE:
            __ZN6TagLib3DSF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE,
          _ZN6TagLib3DSF4FileD0Ev: __ZN6TagLib3DSF4FileD0Ev,
          _ZN6TagLib3DSF4FileD1Ev: __ZN6TagLib3DSF4FileD1Ev,
          _ZN6TagLib3MP410PropertiesD0Ev: __ZN6TagLib3MP410PropertiesD0Ev,
          _ZN6TagLib3MP410PropertiesD1Ev: __ZN6TagLib3MP410PropertiesD1Ev,
          _ZN6TagLib3MP411ItemFactory7factoryE:
            __ZN6TagLib3MP411ItemFactory7factoryE,
          _ZN6TagLib3MP411ItemFactoryD0Ev: __ZN6TagLib3MP411ItemFactoryD0Ev,
          _ZN6TagLib3MP411ItemFactoryD1Ev: __ZN6TagLib3MP411ItemFactoryD1Ev,
          _ZN6TagLib3MP43Tag10setCommentERKNS_6StringE:
            __ZN6TagLib3MP43Tag10setCommentERKNS_6StringE,
          _ZN6TagLib3MP43Tag13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3MP43Tag13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3MP43Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE:
            __ZN6TagLib3MP43Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE,
          _ZN6TagLib3MP43Tag27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib3MP43Tag27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib3MP43Tag7setYearEj: __ZN6TagLib3MP43Tag7setYearEj,
          _ZN6TagLib3MP43Tag8setAlbumERKNS_6StringE:
            __ZN6TagLib3MP43Tag8setAlbumERKNS_6StringE,
          _ZN6TagLib3MP43Tag8setGenreERKNS_6StringE:
            __ZN6TagLib3MP43Tag8setGenreERKNS_6StringE,
          _ZN6TagLib3MP43Tag8setTitleERKNS_6StringE:
            __ZN6TagLib3MP43Tag8setTitleERKNS_6StringE,
          _ZN6TagLib3MP43Tag8setTrackEj: __ZN6TagLib3MP43Tag8setTrackEj,
          _ZN6TagLib3MP43Tag9setArtistERKNS_6StringE:
            __ZN6TagLib3MP43Tag9setArtistERKNS_6StringE,
          _ZN6TagLib3MP43TagD0Ev: __ZN6TagLib3MP43TagD0Ev,
          _ZN6TagLib3MP43TagD1Ev: __ZN6TagLib3MP43TagD1Ev,
          _ZN6TagLib3MP44File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3MP44File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3MP44File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib3MP44File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib3MP44File4saveEv: __ZN6TagLib3MP44File4saveEv,
          _ZN6TagLib3MP44FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS0_11ItemFactoryE:
            __ZN6TagLib3MP44FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS0_11ItemFactoryE,
          _ZN6TagLib3MP44FileD0Ev: __ZN6TagLib3MP44FileD0Ev,
          _ZN6TagLib3MP44FileD1Ev: __ZN6TagLib3MP44FileD1Ev,
          _ZN6TagLib3MP44ItemD0Ev: __ZN6TagLib3MP44ItemD0Ev,
          _ZN6TagLib3MP44ItemD1Ev: __ZN6TagLib3MP44ItemD1Ev,
          _ZN6TagLib3MP48CoverArtD0Ev: __ZN6TagLib3MP48CoverArtD0Ev,
          _ZN6TagLib3MP48CoverArtD1Ev: __ZN6TagLib3MP48CoverArtD1Ev,
          _ZN6TagLib3MPC10PropertiesD0Ev: __ZN6TagLib3MPC10PropertiesD0Ev,
          _ZN6TagLib3MPC10PropertiesD1Ev: __ZN6TagLib3MPC10PropertiesD1Ev,
          _ZN6TagLib3MPC4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3MPC4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3MPC4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib3MPC4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib3MPC4File4saveEv: __ZN6TagLib3MPC4File4saveEv,
          _ZN6TagLib3MPC4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib3MPC4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib3MPC4FileD0Ev: __ZN6TagLib3MPC4FileD0Ev,
          _ZN6TagLib3MPC4FileD1Ev: __ZN6TagLib3MPC4FileD1Ev,
          _ZN6TagLib3MapIKNS_6StringENS_3APE4ItemEE6detachEv:
            __ZN6TagLib3MapIKNS_6StringENS_3APE4ItemEE6detachEv,
          _ZN6TagLib3MapINS_10ByteVectorENS_4ListIPNS_5ID3v25FrameEEEE6detachEv:
            __ZN6TagLib3MapINS_10ByteVectorENS_4ListIPNS_5ID3v25FrameEEEE6detachEv,
          _ZN6TagLib3MapINS_10ByteVectorENS_6StringEE6detachEv:
            __ZN6TagLib3MapINS_10ByteVectorENS_6StringEE6detachEv,
          _ZN6TagLib3MapINS_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE6detachEv:
            __ZN6TagLib3MapINS_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE6detachEv,
          _ZN6TagLib3MapINS_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataEixERKS3_:
            __ZN6TagLib3MapINS_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataEixERKS3_,
          _ZN6TagLib3MapINS_6StringENS_10ByteVectorEE6detachEv:
            __ZN6TagLib3MapINS_6StringENS_10ByteVectorEE6detachEv,
          _ZN6TagLib3MapINS_6StringENS_10StringListEE6detachEv:
            __ZN6TagLib3MapINS_6StringENS_10StringListEE6detachEv,
          _ZN6TagLib3MapINS_6StringENS_3MP44ItemEE6detachEv:
            __ZN6TagLib3MapINS_6StringENS_3MP44ItemEE6detachEv,
          _ZN6TagLib3MapINS_6StringENS_4ListINS_3ASF9AttributeEEEE6detachEv:
            __ZN6TagLib3MapINS_6StringENS_4ListINS_3ASF9AttributeEEEE6detachEv,
          _ZN6TagLib3MapINS_6StringENS_7VariantEE6detachEv:
            __ZN6TagLib3MapINS_6StringENS_7VariantEE6detachEv,
          _ZN6TagLib3MapINS_6StringES1_E6detachEv:
            __ZN6TagLib3MapINS_6StringES1_E6detachEv,
          _ZN6TagLib3MapINS_6StringEiE6insertERKS1_RKi:
            __ZN6TagLib3MapINS_6StringEiE6insertERKS1_RKi,
          _ZN6TagLib3MapIjNS_10ByteVectorEE5clearEv:
            __ZN6TagLib3MapIjNS_10ByteVectorEE5clearEv,
          _ZN6TagLib3MapIjNS_10ByteVectorEEixERKj:
            __ZN6TagLib3MapIjNS_10ByteVectorEEixERKj,
          _ZN6TagLib3Mod10PropertiesD0Ev: __ZN6TagLib3Mod10PropertiesD0Ev,
          _ZN6TagLib3Mod10PropertiesD1Ev: __ZN6TagLib3Mod10PropertiesD1Ev,
          _ZN6TagLib3Mod3Tag10setCommentERKNS_6StringE:
            __ZN6TagLib3Mod3Tag10setCommentERKNS_6StringE,
          _ZN6TagLib3Mod3Tag13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3Mod3Tag13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3Mod3Tag7setYearEj: __ZN6TagLib3Mod3Tag7setYearEj,
          _ZN6TagLib3Mod3Tag8setAlbumERKNS_6StringE:
            __ZN6TagLib3Mod3Tag8setAlbumERKNS_6StringE,
          _ZN6TagLib3Mod3Tag8setGenreERKNS_6StringE:
            __ZN6TagLib3Mod3Tag8setGenreERKNS_6StringE,
          _ZN6TagLib3Mod3Tag8setTitleERKNS_6StringE:
            __ZN6TagLib3Mod3Tag8setTitleERKNS_6StringE,
          _ZN6TagLib3Mod3Tag8setTrackEj: __ZN6TagLib3Mod3Tag8setTrackEj,
          _ZN6TagLib3Mod3Tag9setArtistERKNS_6StringE:
            __ZN6TagLib3Mod3Tag9setArtistERKNS_6StringE,
          _ZN6TagLib3Mod3TagD0Ev: __ZN6TagLib3Mod3TagD0Ev,
          _ZN6TagLib3Mod3TagD1Ev: __ZN6TagLib3Mod3TagD1Ev,
          _ZN6TagLib3Mod4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3Mod4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3Mod4File4saveEv: __ZN6TagLib3Mod4File4saveEv,
          _ZN6TagLib3Mod4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib3Mod4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib3Mod4FileD0Ev: __ZN6TagLib3Mod4FileD0Ev,
          _ZN6TagLib3Mod4FileD1Ev: __ZN6TagLib3Mod4FileD1Ev,
          _ZN6TagLib3Mod8FileBaseD0Ev: __ZN6TagLib3Mod8FileBaseD0Ev,
          _ZN6TagLib3Mod8FileBaseD1Ev: __ZN6TagLib3Mod8FileBaseD1Ev,
          _ZN6TagLib3Ogg10PageHeaderD0Ev: __ZN6TagLib3Ogg10PageHeaderD0Ev,
          _ZN6TagLib3Ogg10PageHeaderD1Ev: __ZN6TagLib3Ogg10PageHeaderD1Ev,
          _ZN6TagLib3Ogg11XiphComment10setCommentERKNS_6StringE:
            __ZN6TagLib3Ogg11XiphComment10setCommentERKNS_6StringE,
          _ZN6TagLib3Ogg11XiphComment13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3Ogg11XiphComment13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3Ogg11XiphComment20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE:
            __ZN6TagLib3Ogg11XiphComment20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE,
          _ZN6TagLib3Ogg11XiphComment7setYearEj:
            __ZN6TagLib3Ogg11XiphComment7setYearEj,
          _ZN6TagLib3Ogg11XiphComment8setAlbumERKNS_6StringE:
            __ZN6TagLib3Ogg11XiphComment8setAlbumERKNS_6StringE,
          _ZN6TagLib3Ogg11XiphComment8setGenreERKNS_6StringE:
            __ZN6TagLib3Ogg11XiphComment8setGenreERKNS_6StringE,
          _ZN6TagLib3Ogg11XiphComment8setTitleERKNS_6StringE:
            __ZN6TagLib3Ogg11XiphComment8setTitleERKNS_6StringE,
          _ZN6TagLib3Ogg11XiphComment8setTrackEj:
            __ZN6TagLib3Ogg11XiphComment8setTrackEj,
          _ZN6TagLib3Ogg11XiphComment9setArtistERKNS_6StringE:
            __ZN6TagLib3Ogg11XiphComment9setArtistERKNS_6StringE,
          _ZN6TagLib3Ogg11XiphCommentD0Ev: __ZN6TagLib3Ogg11XiphCommentD0Ev,
          _ZN6TagLib3Ogg11XiphCommentD1Ev: __ZN6TagLib3Ogg11XiphCommentD1Ev,
          _ZN6TagLib3Ogg4FLAC4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3Ogg4FLAC4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3Ogg4FLAC4File4saveEv: __ZN6TagLib3Ogg4FLAC4File4saveEv,
          _ZN6TagLib3Ogg4FLAC4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib3Ogg4FLAC4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib3Ogg4FLAC4FileD0Ev: __ZN6TagLib3Ogg4FLAC4FileD0Ev,
          _ZN6TagLib3Ogg4FLAC4FileD1Ev: __ZN6TagLib3Ogg4FLAC4FileD1Ev,
          _ZN6TagLib3Ogg4File4saveEv: __ZN6TagLib3Ogg4File4saveEv,
          _ZN6TagLib3Ogg4FileD0Ev: __ZN6TagLib3Ogg4FileD0Ev,
          _ZN6TagLib3Ogg4FileD1Ev: __ZN6TagLib3Ogg4FileD1Ev,
          _ZN6TagLib3Ogg4Opus10PropertiesD0Ev:
            __ZN6TagLib3Ogg4Opus10PropertiesD0Ev,
          _ZN6TagLib3Ogg4Opus10PropertiesD1Ev:
            __ZN6TagLib3Ogg4Opus10PropertiesD1Ev,
          _ZN6TagLib3Ogg4Opus4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3Ogg4Opus4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3Ogg4Opus4File4saveEv: __ZN6TagLib3Ogg4Opus4File4saveEv,
          _ZN6TagLib3Ogg4Opus4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib3Ogg4Opus4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib3Ogg4Opus4FileD0Ev: __ZN6TagLib3Ogg4Opus4FileD0Ev,
          _ZN6TagLib3Ogg4Opus4FileD1Ev: __ZN6TagLib3Ogg4Opus4FileD1Ev,
          _ZN6TagLib3Ogg4PageD0Ev: __ZN6TagLib3Ogg4PageD0Ev,
          _ZN6TagLib3Ogg4PageD1Ev: __ZN6TagLib3Ogg4PageD1Ev,
          _ZN6TagLib3Ogg5Speex10PropertiesD0Ev:
            __ZN6TagLib3Ogg5Speex10PropertiesD0Ev,
          _ZN6TagLib3Ogg5Speex10PropertiesD1Ev:
            __ZN6TagLib3Ogg5Speex10PropertiesD1Ev,
          _ZN6TagLib3Ogg5Speex4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3Ogg5Speex4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3Ogg5Speex4File4saveEv: __ZN6TagLib3Ogg5Speex4File4saveEv,
          _ZN6TagLib3Ogg5Speex4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib3Ogg5Speex4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib3Ogg5Speex4FileD0Ev: __ZN6TagLib3Ogg5Speex4FileD0Ev,
          _ZN6TagLib3Ogg5Speex4FileD1Ev: __ZN6TagLib3Ogg5Speex4FileD1Ev,
          _ZN6TagLib3S3M10PropertiesD0Ev: __ZN6TagLib3S3M10PropertiesD0Ev,
          _ZN6TagLib3S3M10PropertiesD1Ev: __ZN6TagLib3S3M10PropertiesD1Ev,
          _ZN6TagLib3S3M4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3S3M4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3S3M4File4saveEv: __ZN6TagLib3S3M4File4saveEv,
          _ZN6TagLib3S3M4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib3S3M4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib3S3M4FileD0Ev: __ZN6TagLib3S3M4FileD0Ev,
          _ZN6TagLib3S3M4FileD1Ev: __ZN6TagLib3S3M4FileD1Ev,
          _ZN6TagLib3Tag13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib3Tag13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE:
            __ZN6TagLib3Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE,
          _ZN6TagLib3Tag27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib3Tag27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib3TagD0Ev: __ZN6TagLib3TagD0Ev,
          _ZN6TagLib3TagD1Ev: __ZN6TagLib3TagD1Ev,
          _ZN6TagLib4FLAC10PropertiesD0Ev: __ZN6TagLib4FLAC10PropertiesD0Ev,
          _ZN6TagLib4FLAC10PropertiesD1Ev: __ZN6TagLib4FLAC10PropertiesD1Ev,
          _ZN6TagLib4FLAC13MetadataBlockD0Ev:
            __ZN6TagLib4FLAC13MetadataBlockD0Ev,
          _ZN6TagLib4FLAC13MetadataBlockD1Ev:
            __ZN6TagLib4FLAC13MetadataBlockD1Ev,
          _ZN6TagLib4FLAC20UnknownMetadataBlockD0Ev:
            __ZN6TagLib4FLAC20UnknownMetadataBlockD0Ev,
          _ZN6TagLib4FLAC20UnknownMetadataBlockD1Ev:
            __ZN6TagLib4FLAC20UnknownMetadataBlockD1Ev,
          _ZN6TagLib4FLAC4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib4FLAC4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib4FLAC4File20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE:
            __ZN6TagLib4FLAC4File20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE,
          _ZN6TagLib4FLAC4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib4FLAC4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib4FLAC4File4saveEv: __ZN6TagLib4FLAC4File4saveEv,
          _ZN6TagLib4FLAC4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE:
            __ZN6TagLib4FLAC4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE,
          _ZN6TagLib4FLAC4FileD0Ev: __ZN6TagLib4FLAC4FileD0Ev,
          _ZN6TagLib4FLAC4FileD1Ev: __ZN6TagLib4FLAC4FileD1Ev,
          _ZN6TagLib4FLAC7PictureD0Ev: __ZN6TagLib4FLAC7PictureD0Ev,
          _ZN6TagLib4FLAC7PictureD1Ev: __ZN6TagLib4FLAC7PictureD1Ev,
          _ZN6TagLib4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib4File20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE:
            __ZN6TagLib4File20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE,
          _ZN6TagLib4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib4FileD0Ev: __ZN6TagLib4FileD0Ev,
          _ZN6TagLib4FileD1Ev: __ZN6TagLib4FileD1Ev,
          _ZN6TagLib4FileD2Ev: __ZN6TagLib4FileD2Ev,
          _ZN6TagLib4ListINS_10ByteVectorEE6appendERKS2_:
            __ZN6TagLib4ListINS_10ByteVectorEE6appendERKS2_,
          _ZN6TagLib4ListINS_10ByteVectorEE6detachEv:
            __ZN6TagLib4ListINS_10ByteVectorEE6detachEv,
          _ZN6TagLib4ListINS_10ByteVectorEEaSESt16initializer_listIS1_E:
            __ZN6TagLib4ListINS_10ByteVectorEEaSESt16initializer_listIS1_E,
          _ZN6TagLib4ListINS_3APE4ItemEE6detachEv:
            __ZN6TagLib4ListINS_3APE4ItemEE6detachEv,
          _ZN6TagLib4ListINS_3ASF9AttributeEE6detachEv:
            __ZN6TagLib4ListINS_3ASF9AttributeEE6detachEv,
          _ZN6TagLib4ListINS_3MP48AtomDataEE6detachEv:
            __ZN6TagLib4ListINS_3MP48AtomDataEE6detachEv,
          _ZN6TagLib4ListINS_3MP48CoverArtEE6detachEv:
            __ZN6TagLib4ListINS_3MP48CoverArtEE6detachEv,
          _ZN6TagLib4ListINS_3MapINS_6StringENS_7VariantEEEE6detachEv:
            __ZN6TagLib4ListINS_3MapINS_6StringENS_7VariantEEEE6detachEv,
          _ZN6TagLib4ListINS_5ID3v219RelativeVolumeFrame11ChannelTypeEE6detachEv:
            __ZN6TagLib4ListINS_5ID3v219RelativeVolumeFrame11ChannelTypeEE6detachEv,
          _ZN6TagLib4ListINS_5ID3v221EventTimingCodesFrame12SynchedEventEE6detachEv:
            __ZN6TagLib4ListINS_5ID3v221EventTimingCodesFrame12SynchedEventEE6detachEv,
          _ZN6TagLib4ListINS_5ID3v223SynchronizedLyricsFrame11SynchedTextEE6detachEv:
            __ZN6TagLib4ListINS_5ID3v223SynchronizedLyricsFrame11SynchedTextEE6detachEv,
          _ZN6TagLib4ListINS_6StringEE6appendERKS2_:
            __ZN6TagLib4ListINS_6StringEE6appendERKS2_,
          _ZN6TagLib4ListINS_6StringEE6detachEv:
            __ZN6TagLib4ListINS_6StringEE6detachEv,
          _ZN6TagLib4ListINS_6StringEEaSESt16initializer_listIS1_E:
            __ZN6TagLib4ListINS_6StringEEaSESt16initializer_listIS1_E,
          _ZN6TagLib4ListIPKNS_7FileRef16FileTypeResolverEE11ListPrivateIS4_ED2Ev:
            __ZN6TagLib4ListIPKNS_7FileRef16FileTypeResolverEE11ListPrivateIS4_ED2Ev,
          _ZN6TagLib4ListIPKNS_7FileRef16FileTypeResolverEE6detachEv:
            __ZN6TagLib4ListIPKNS_7FileRef16FileTypeResolverEE6detachEv,
          _ZN6TagLib4ListIPNS_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS5_ED2Ev:
            __ZN6TagLib4ListIPNS_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS5_ED2Ev,
          _ZN6TagLib4ListIPNS_3ASF4File11FilePrivate10BaseObjectEE6detachEv:
            __ZN6TagLib4ListIPNS_3ASF4File11FilePrivate10BaseObjectEE6detachEv,
          _ZN6TagLib4ListIPNS_3MP44AtomEE11ListPrivateIS3_ED2Ev:
            __ZN6TagLib4ListIPNS_3MP44AtomEE11ListPrivateIS3_ED2Ev,
          _ZN6TagLib4ListIPNS_3MP44AtomEE6detachEv:
            __ZN6TagLib4ListIPNS_3MP44AtomEE6detachEv,
          _ZN6TagLib4ListIPNS_3Ogg4PageEE11ListPrivateIS3_ED2Ev:
            __ZN6TagLib4ListIPNS_3Ogg4PageEE11ListPrivateIS3_ED2Ev,
          _ZN6TagLib4ListIPNS_3Ogg4PageEE6detachEv:
            __ZN6TagLib4ListIPNS_3Ogg4PageEE6detachEv,
          _ZN6TagLib4ListIPNS_4FLAC13MetadataBlockEE11ListPrivateIS3_ED2Ev:
            __ZN6TagLib4ListIPNS_4FLAC13MetadataBlockEE11ListPrivateIS3_ED2Ev,
          _ZN6TagLib4ListIPNS_4FLAC13MetadataBlockEE6detachEv:
            __ZN6TagLib4ListIPNS_4FLAC13MetadataBlockEE6detachEv,
          _ZN6TagLib4ListIPNS_4FLAC7PictureEE11ListPrivateIS3_ED2Ev:
            __ZN6TagLib4ListIPNS_4FLAC7PictureEE11ListPrivateIS3_ED2Ev,
          _ZN6TagLib4ListIPNS_4FLAC7PictureEE6detachEv:
            __ZN6TagLib4ListIPNS_4FLAC7PictureEE6detachEv,
          _ZN6TagLib4ListIPNS_5ID3v25FrameEE11ListPrivateIS3_ED2Ev:
            __ZN6TagLib4ListIPNS_5ID3v25FrameEE11ListPrivateIS3_ED2Ev,
          _ZN6TagLib4ListIPNS_5ID3v25FrameEE6appendERKS3_:
            __ZN6TagLib4ListIPNS_5ID3v25FrameEE6appendERKS3_,
          _ZN6TagLib4ListIPNS_5ID3v25FrameEE6detachEv:
            __ZN6TagLib4ListIPNS_5ID3v25FrameEE6detachEv,
          _ZN6TagLib4ListIPcE11ListPrivateIS1_ED2Ev:
            __ZN6TagLib4ListIPcE11ListPrivateIS1_ED2Ev,
          _ZN6TagLib4ListIPcE6detachEv: __ZN6TagLib4ListIPcE6detachEv,
          _ZN6TagLib4ListIiE6detachEv: __ZN6TagLib4ListIiE6detachEv,
          _ZN6TagLib4MPEG10PropertiesD0Ev: __ZN6TagLib4MPEG10PropertiesD0Ev,
          _ZN6TagLib4MPEG10PropertiesD1Ev: __ZN6TagLib4MPEG10PropertiesD1Ev,
          _ZN6TagLib4MPEG10XingHeaderD0Ev: __ZN6TagLib4MPEG10XingHeaderD0Ev,
          _ZN6TagLib4MPEG10XingHeaderD1Ev: __ZN6TagLib4MPEG10XingHeaderD1Ev,
          _ZN6TagLib4MPEG4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib4MPEG4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib4MPEG4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib4MPEG4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib4MPEG4File4saveEv: __ZN6TagLib4MPEG4File4saveEv,
          _ZN6TagLib4MPEG4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE:
            __ZN6TagLib4MPEG4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE,
          _ZN6TagLib4MPEG4FileD0Ev: __ZN6TagLib4MPEG4FileD0Ev,
          _ZN6TagLib4MPEG4FileD1Ev: __ZN6TagLib4MPEG4FileD1Ev,
          _ZN6TagLib4MPEG6HeaderD0Ev: __ZN6TagLib4MPEG6HeaderD0Ev,
          _ZN6TagLib4MPEG6HeaderD1Ev: __ZN6TagLib4MPEG6HeaderD1Ev,
          _ZN6TagLib4RIFF3WAV10PropertiesD0Ev:
            __ZN6TagLib4RIFF3WAV10PropertiesD0Ev,
          _ZN6TagLib4RIFF3WAV10PropertiesD1Ev:
            __ZN6TagLib4RIFF3WAV10PropertiesD1Ev,
          _ZN6TagLib4RIFF3WAV4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib4RIFF3WAV4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib4RIFF3WAV4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib4RIFF3WAV4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib4RIFF3WAV4File4saveEv: __ZN6TagLib4RIFF3WAV4File4saveEv,
          _ZN6TagLib4RIFF3WAV4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE:
            __ZN6TagLib4RIFF3WAV4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE,
          _ZN6TagLib4RIFF3WAV4FileD0Ev: __ZN6TagLib4RIFF3WAV4FileD0Ev,
          _ZN6TagLib4RIFF3WAV4FileD1Ev: __ZN6TagLib4RIFF3WAV4FileD1Ev,
          _ZN6TagLib4RIFF4AIFF10PropertiesD0Ev:
            __ZN6TagLib4RIFF4AIFF10PropertiesD0Ev,
          _ZN6TagLib4RIFF4AIFF10PropertiesD1Ev:
            __ZN6TagLib4RIFF4AIFF10PropertiesD1Ev,
          _ZN6TagLib4RIFF4AIFF4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib4RIFF4AIFF4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib4RIFF4AIFF4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib4RIFF4AIFF4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib4RIFF4AIFF4File4saveEv: __ZN6TagLib4RIFF4AIFF4File4saveEv,
          _ZN6TagLib4RIFF4AIFF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE:
            __ZN6TagLib4RIFF4AIFF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE,
          _ZN6TagLib4RIFF4AIFF4FileD0Ev: __ZN6TagLib4RIFF4AIFF4FileD0Ev,
          _ZN6TagLib4RIFF4AIFF4FileD1Ev: __ZN6TagLib4RIFF4AIFF4FileD1Ev,
          _ZN6TagLib4RIFF4FileD0Ev: __ZN6TagLib4RIFF4FileD0Ev,
          _ZN6TagLib4RIFF4FileD1Ev: __ZN6TagLib4RIFF4FileD1Ev,
          _ZN6TagLib4RIFF4Info13StringHandlerD0Ev:
            __ZN6TagLib4RIFF4Info13StringHandlerD0Ev,
          _ZN6TagLib4RIFF4Info13StringHandlerD1Ev:
            __ZN6TagLib4RIFF4Info13StringHandlerD1Ev,
          _ZN6TagLib4RIFF4Info3Tag10setCommentERKNS_6StringE:
            __ZN6TagLib4RIFF4Info3Tag10setCommentERKNS_6StringE,
          _ZN6TagLib4RIFF4Info3Tag13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib4RIFF4Info3Tag13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib4RIFF4Info3Tag27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib4RIFF4Info3Tag27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib4RIFF4Info3Tag7setYearEj:
            __ZN6TagLib4RIFF4Info3Tag7setYearEj,
          _ZN6TagLib4RIFF4Info3Tag8setAlbumERKNS_6StringE:
            __ZN6TagLib4RIFF4Info3Tag8setAlbumERKNS_6StringE,
          _ZN6TagLib4RIFF4Info3Tag8setGenreERKNS_6StringE:
            __ZN6TagLib4RIFF4Info3Tag8setGenreERKNS_6StringE,
          _ZN6TagLib4RIFF4Info3Tag8setTitleERKNS_6StringE:
            __ZN6TagLib4RIFF4Info3Tag8setTitleERKNS_6StringE,
          _ZN6TagLib4RIFF4Info3Tag8setTrackEj:
            __ZN6TagLib4RIFF4Info3Tag8setTrackEj,
          _ZN6TagLib4RIFF4Info3Tag9setArtistERKNS_6StringE:
            __ZN6TagLib4RIFF4Info3Tag9setArtistERKNS_6StringE,
          _ZN6TagLib4RIFF4Info3TagD0Ev: __ZN6TagLib4RIFF4Info3TagD0Ev,
          _ZN6TagLib4RIFF4Info3TagD1Ev: __ZN6TagLib4RIFF4Info3TagD1Ev,
          _ZN6TagLib5ID3v113StringHandlerD0Ev:
            __ZN6TagLib5ID3v113StringHandlerD0Ev,
          _ZN6TagLib5ID3v113StringHandlerD1Ev:
            __ZN6TagLib5ID3v113StringHandlerD1Ev,
          _ZN6TagLib5ID3v13Tag10setCommentERKNS_6StringE:
            __ZN6TagLib5ID3v13Tag10setCommentERKNS_6StringE,
          _ZN6TagLib5ID3v13Tag7setYearEj: __ZN6TagLib5ID3v13Tag7setYearEj,
          _ZN6TagLib5ID3v13Tag8setAlbumERKNS_6StringE:
            __ZN6TagLib5ID3v13Tag8setAlbumERKNS_6StringE,
          _ZN6TagLib5ID3v13Tag8setGenreERKNS_6StringE:
            __ZN6TagLib5ID3v13Tag8setGenreERKNS_6StringE,
          _ZN6TagLib5ID3v13Tag8setTitleERKNS_6StringE:
            __ZN6TagLib5ID3v13Tag8setTitleERKNS_6StringE,
          _ZN6TagLib5ID3v13Tag8setTrackEj: __ZN6TagLib5ID3v13Tag8setTrackEj,
          _ZN6TagLib5ID3v13Tag9setArtistERKNS_6StringE:
            __ZN6TagLib5ID3v13Tag9setArtistERKNS_6StringE,
          _ZN6TagLib5ID3v13TagD0Ev: __ZN6TagLib5ID3v13TagD0Ev,
          _ZN6TagLib5ID3v13TagD1Ev: __ZN6TagLib5ID3v13TagD1Ev,
          _ZN6TagLib5ID3v212ChapterFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v212ChapterFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v212ChapterFrameD0Ev:
            __ZN6TagLib5ID3v212ChapterFrameD0Ev,
          _ZN6TagLib5ID3v212ChapterFrameD1Ev:
            __ZN6TagLib5ID3v212ChapterFrameD1Ev,
          _ZN6TagLib5ID3v212FrameFactory22setDefaultTextEncodingENS_6String4TypeE:
            __ZN6TagLib5ID3v212FrameFactory22setDefaultTextEncodingENS_6String4TypeE,
          _ZN6TagLib5ID3v212FrameFactory7factoryE:
            __ZN6TagLib5ID3v212FrameFactory7factoryE,
          _ZN6TagLib5ID3v212FrameFactory8instanceEv:
            __ZN6TagLib5ID3v212FrameFactory8instanceEv,
          _ZN6TagLib5ID3v212FrameFactoryD0Ev:
            __ZN6TagLib5ID3v212FrameFactoryD0Ev,
          _ZN6TagLib5ID3v212FrameFactoryD1Ev:
            __ZN6TagLib5ID3v212FrameFactoryD1Ev,
          _ZN6TagLib5ID3v212PodcastFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v212PodcastFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v212PodcastFrameD0Ev:
            __ZN6TagLib5ID3v212PodcastFrameD0Ev,
          _ZN6TagLib5ID3v212PodcastFrameD1Ev:
            __ZN6TagLib5ID3v212PodcastFrameD1Ev,
          _ZN6TagLib5ID3v212PrivateFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v212PrivateFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v212PrivateFrameD0Ev:
            __ZN6TagLib5ID3v212PrivateFrameD0Ev,
          _ZN6TagLib5ID3v212PrivateFrameD1Ev:
            __ZN6TagLib5ID3v212PrivateFrameD1Ev,
          _ZN6TagLib5ID3v212UnknownFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v212UnknownFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v212UnknownFrameD0Ev:
            __ZN6TagLib5ID3v212UnknownFrameD0Ev,
          _ZN6TagLib5ID3v212UnknownFrameD1Ev:
            __ZN6TagLib5ID3v212UnknownFrameD1Ev,
          _ZN6TagLib5ID3v212UrlLinkFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v212UrlLinkFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v212UrlLinkFrame6setUrlERKNS_6StringE:
            __ZN6TagLib5ID3v212UrlLinkFrame6setUrlERKNS_6StringE,
          _ZN6TagLib5ID3v212UrlLinkFrame7setTextERKNS_6StringE:
            __ZN6TagLib5ID3v212UrlLinkFrame7setTextERKNS_6StringE,
          _ZN6TagLib5ID3v212UrlLinkFrameD0Ev:
            __ZN6TagLib5ID3v212UrlLinkFrameD0Ev,
          _ZN6TagLib5ID3v212UrlLinkFrameD1Ev:
            __ZN6TagLib5ID3v212UrlLinkFrameD1Ev,
          _ZN6TagLib5ID3v213CommentsFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v213CommentsFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v213CommentsFrame7setTextERKNS_6StringE:
            __ZN6TagLib5ID3v213CommentsFrame7setTextERKNS_6StringE,
          _ZN6TagLib5ID3v213CommentsFrameD0Ev:
            __ZN6TagLib5ID3v213CommentsFrameD0Ev,
          _ZN6TagLib5ID3v213CommentsFrameD1Ev:
            __ZN6TagLib5ID3v213CommentsFrameD1Ev,
          _ZN6TagLib5ID3v214ExtendedHeaderD0Ev:
            __ZN6TagLib5ID3v214ExtendedHeaderD0Ev,
          _ZN6TagLib5ID3v214ExtendedHeaderD1Ev:
            __ZN6TagLib5ID3v214ExtendedHeaderD1Ev,
          _ZN6TagLib5ID3v214OwnershipFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v214OwnershipFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v214OwnershipFrameD0Ev:
            __ZN6TagLib5ID3v214OwnershipFrameD0Ev,
          _ZN6TagLib5ID3v214OwnershipFrameD1Ev:
            __ZN6TagLib5ID3v214OwnershipFrameD1Ev,
          _ZN6TagLib5ID3v216UserUrlLinkFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v216UserUrlLinkFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v216UserUrlLinkFrameD0Ev:
            __ZN6TagLib5ID3v216UserUrlLinkFrameD0Ev,
          _ZN6TagLib5ID3v216UserUrlLinkFrameD1Ev:
            __ZN6TagLib5ID3v216UserUrlLinkFrameD1Ev,
          _ZN6TagLib5ID3v218PopularimeterFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v218PopularimeterFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v218PopularimeterFrameD0Ev:
            __ZN6TagLib5ID3v218PopularimeterFrameD0Ev,
          _ZN6TagLib5ID3v218PopularimeterFrameD1Ev:
            __ZN6TagLib5ID3v218PopularimeterFrameD1Ev,
          _ZN6TagLib5ID3v219Latin1StringHandlerD0Ev:
            __ZN6TagLib5ID3v219Latin1StringHandlerD0Ev,
          _ZN6TagLib5ID3v219Latin1StringHandlerD1Ev:
            __ZN6TagLib5ID3v219Latin1StringHandlerD1Ev,
          _ZN6TagLib5ID3v219RelativeVolumeFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v219RelativeVolumeFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v219RelativeVolumeFrameD0Ev:
            __ZN6TagLib5ID3v219RelativeVolumeFrameD0Ev,
          _ZN6TagLib5ID3v219RelativeVolumeFrameD1Ev:
            __ZN6TagLib5ID3v219RelativeVolumeFrameD1Ev,
          _ZN6TagLib5ID3v220AttachedPictureFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v220AttachedPictureFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v220AttachedPictureFrameD0Ev:
            __ZN6TagLib5ID3v220AttachedPictureFrameD0Ev,
          _ZN6TagLib5ID3v220AttachedPictureFrameD1Ev:
            __ZN6TagLib5ID3v220AttachedPictureFrameD1Ev,
          _ZN6TagLib5ID3v220AttachedPictureFrameD2Ev:
            __ZN6TagLib5ID3v220AttachedPictureFrameD2Ev,
          _ZN6TagLib5ID3v220TableOfContentsFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v220TableOfContentsFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v220TableOfContentsFrameD0Ev:
            __ZN6TagLib5ID3v220TableOfContentsFrameD0Ev,
          _ZN6TagLib5ID3v220TableOfContentsFrameD1Ev:
            __ZN6TagLib5ID3v220TableOfContentsFrameD1Ev,
          _ZN6TagLib5ID3v221EventTimingCodesFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v221EventTimingCodesFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v221EventTimingCodesFrameD0Ev:
            __ZN6TagLib5ID3v221EventTimingCodesFrameD0Ev,
          _ZN6TagLib5ID3v221EventTimingCodesFrameD1Ev:
            __ZN6TagLib5ID3v221EventTimingCodesFrameD1Ev,
          _ZN6TagLib5ID3v223AttachedPictureFrameV2211parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v223AttachedPictureFrameV2211parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v223AttachedPictureFrameV22D0Ev:
            __ZN6TagLib5ID3v223AttachedPictureFrameV22D0Ev,
          _ZN6TagLib5ID3v223SynchronizedLyricsFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v223SynchronizedLyricsFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v223SynchronizedLyricsFrameD0Ev:
            __ZN6TagLib5ID3v223SynchronizedLyricsFrameD0Ev,
          _ZN6TagLib5ID3v223SynchronizedLyricsFrameD1Ev:
            __ZN6TagLib5ID3v223SynchronizedLyricsFrameD1Ev,
          _ZN6TagLib5ID3v223TextIdentificationFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v223TextIdentificationFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v223TextIdentificationFrame7setTextERKNS_6StringE:
            __ZN6TagLib5ID3v223TextIdentificationFrame7setTextERKNS_6StringE,
          _ZN6TagLib5ID3v223TextIdentificationFrameD0Ev:
            __ZN6TagLib5ID3v223TextIdentificationFrameD0Ev,
          _ZN6TagLib5ID3v223TextIdentificationFrameD1Ev:
            __ZN6TagLib5ID3v223TextIdentificationFrameD1Ev,
          _ZN6TagLib5ID3v225UniqueFileIdentifierFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v225UniqueFileIdentifierFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v225UniqueFileIdentifierFrameD0Ev:
            __ZN6TagLib5ID3v225UniqueFileIdentifierFrameD0Ev,
          _ZN6TagLib5ID3v225UniqueFileIdentifierFrameD1Ev:
            __ZN6TagLib5ID3v225UniqueFileIdentifierFrameD1Ev,
          _ZN6TagLib5ID3v225UnsynchronizedLyricsFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v225UnsynchronizedLyricsFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v225UnsynchronizedLyricsFrame7setTextERKNS_6StringE:
            __ZN6TagLib5ID3v225UnsynchronizedLyricsFrame7setTextERKNS_6StringE,
          _ZN6TagLib5ID3v225UnsynchronizedLyricsFrameD0Ev:
            __ZN6TagLib5ID3v225UnsynchronizedLyricsFrameD0Ev,
          _ZN6TagLib5ID3v225UnsynchronizedLyricsFrameD1Ev:
            __ZN6TagLib5ID3v225UnsynchronizedLyricsFrameD1Ev,
          _ZN6TagLib5ID3v227UserTextIdentificationFrame7setTextERKNS_6StringE:
            __ZN6TagLib5ID3v227UserTextIdentificationFrame7setTextERKNS_6StringE,
          _ZN6TagLib5ID3v227UserTextIdentificationFrameD0Ev:
            __ZN6TagLib5ID3v227UserTextIdentificationFrameD0Ev,
          _ZN6TagLib5ID3v227UserTextIdentificationFrameD1Ev:
            __ZN6TagLib5ID3v227UserTextIdentificationFrameD1Ev,
          _ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrame11parseFieldsERKNS_10ByteVectorE:
            __ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrame11parseFieldsERKNS_10ByteVectorE,
          _ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrameD0Ev:
            __ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrameD0Ev,
          _ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrameD1Ev:
            __ZN6TagLib5ID3v230GeneralEncapsulatedObjectFrameD1Ev,
          _ZN6TagLib5ID3v23Tag10setCommentERKNS_6StringE:
            __ZN6TagLib5ID3v23Tag10setCommentERKNS_6StringE,
          _ZN6TagLib5ID3v23Tag13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib5ID3v23Tag13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib5ID3v23Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE:
            __ZN6TagLib5ID3v23Tag20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS2_NS_7VariantEEEEE,
          _ZN6TagLib5ID3v23Tag27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib5ID3v23Tag27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib5ID3v23Tag7setYearEj: __ZN6TagLib5ID3v23Tag7setYearEj,
          _ZN6TagLib5ID3v23Tag8setAlbumERKNS_6StringE:
            __ZN6TagLib5ID3v23Tag8setAlbumERKNS_6StringE,
          _ZN6TagLib5ID3v23Tag8setGenreERKNS_6StringE:
            __ZN6TagLib5ID3v23Tag8setGenreERKNS_6StringE,
          _ZN6TagLib5ID3v23Tag8setTitleERKNS_6StringE:
            __ZN6TagLib5ID3v23Tag8setTitleERKNS_6StringE,
          _ZN6TagLib5ID3v23Tag8setTrackEj: __ZN6TagLib5ID3v23Tag8setTrackEj,
          _ZN6TagLib5ID3v23Tag9setArtistERKNS_6StringE:
            __ZN6TagLib5ID3v23Tag9setArtistERKNS_6StringE,
          _ZN6TagLib5ID3v23TagD0Ev: __ZN6TagLib5ID3v23TagD0Ev,
          _ZN6TagLib5ID3v23TagD1Ev: __ZN6TagLib5ID3v23TagD1Ev,
          _ZN6TagLib5ID3v25Frame12lyricsPrefixE:
            __ZN6TagLib5ID3v25Frame12lyricsPrefixE,
          _ZN6TagLib5ID3v25Frame13commentPrefixE:
            __ZN6TagLib5ID3v25Frame13commentPrefixE,
          _ZN6TagLib5ID3v25Frame16instrumentPrefixE:
            __ZN6TagLib5ID3v25Frame16instrumentPrefixE,
          _ZN6TagLib5ID3v25Frame6HeaderD0Ev: __ZN6TagLib5ID3v25Frame6HeaderD0Ev,
          _ZN6TagLib5ID3v25Frame6HeaderD1Ev: __ZN6TagLib5ID3v25Frame6HeaderD1Ev,
          _ZN6TagLib5ID3v25Frame7setTextERKNS_6StringE:
            __ZN6TagLib5ID3v25Frame7setTextERKNS_6StringE,
          _ZN6TagLib5ID3v25Frame9urlPrefixE: __ZN6TagLib5ID3v25Frame9urlPrefixE,
          _ZN6TagLib5ID3v25FrameD0Ev: __ZN6TagLib5ID3v25FrameD0Ev,
          _ZN6TagLib5ID3v25FrameD1Ev: __ZN6TagLib5ID3v25FrameD1Ev,
          _ZN6TagLib5ID3v26FooterD0Ev: __ZN6TagLib5ID3v26FooterD0Ev,
          _ZN6TagLib5ID3v26FooterD1Ev: __ZN6TagLib5ID3v26FooterD1Ev,
          _ZN6TagLib5ID3v26HeaderD0Ev: __ZN6TagLib5ID3v26HeaderD0Ev,
          _ZN6TagLib5ID3v26HeaderD1Ev: __ZN6TagLib5ID3v26HeaderD1Ev,
          _ZN6TagLib6DSDIFF10PropertiesD0Ev: __ZN6TagLib6DSDIFF10PropertiesD0Ev,
          _ZN6TagLib6DSDIFF10PropertiesD1Ev: __ZN6TagLib6DSDIFF10PropertiesD1Ev,
          _ZN6TagLib6DSDIFF4DIIN3Tag10setCommentERKNS_6StringE:
            __ZN6TagLib6DSDIFF4DIIN3Tag10setCommentERKNS_6StringE,
          _ZN6TagLib6DSDIFF4DIIN3Tag13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib6DSDIFF4DIIN3Tag13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib6DSDIFF4DIIN3Tag7setYearEj:
            __ZN6TagLib6DSDIFF4DIIN3Tag7setYearEj,
          _ZN6TagLib6DSDIFF4DIIN3Tag8setAlbumERKNS_6StringE:
            __ZN6TagLib6DSDIFF4DIIN3Tag8setAlbumERKNS_6StringE,
          _ZN6TagLib6DSDIFF4DIIN3Tag8setGenreERKNS_6StringE:
            __ZN6TagLib6DSDIFF4DIIN3Tag8setGenreERKNS_6StringE,
          _ZN6TagLib6DSDIFF4DIIN3Tag8setTitleERKNS_6StringE:
            __ZN6TagLib6DSDIFF4DIIN3Tag8setTitleERKNS_6StringE,
          _ZN6TagLib6DSDIFF4DIIN3Tag8setTrackEj:
            __ZN6TagLib6DSDIFF4DIIN3Tag8setTrackEj,
          _ZN6TagLib6DSDIFF4DIIN3Tag9setArtistERKNS_6StringE:
            __ZN6TagLib6DSDIFF4DIIN3Tag9setArtistERKNS_6StringE,
          _ZN6TagLib6DSDIFF4DIIN3TagD0Ev: __ZN6TagLib6DSDIFF4DIIN3TagD0Ev,
          _ZN6TagLib6DSDIFF4DIIN3TagD1Ev: __ZN6TagLib6DSDIFF4DIIN3TagD1Ev,
          _ZN6TagLib6DSDIFF4File11FilePrivateD2Ev:
            __ZN6TagLib6DSDIFF4File11FilePrivateD2Ev,
          _ZN6TagLib6DSDIFF4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib6DSDIFF4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib6DSDIFF4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib6DSDIFF4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib6DSDIFF4File4saveEv: __ZN6TagLib6DSDIFF4File4saveEv,
          _ZN6TagLib6DSDIFF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE:
            __ZN6TagLib6DSDIFF4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE,
          _ZN6TagLib6DSDIFF4FileD0Ev: __ZN6TagLib6DSDIFF4FileD0Ev,
          _ZN6TagLib6DSDIFF4FileD1Ev: __ZN6TagLib6DSDIFF4FileD1Ev,
          _ZN6TagLib6StringC1EPKcNS0_4TypeE: __ZN6TagLib6StringC1EPKcNS0_4TypeE,
          _ZN6TagLib6StringC1ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS0_4TypeE:
            __ZN6TagLib6StringC1ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS0_4TypeE,
          _ZN6TagLib6StringC1ERKS0_: __ZN6TagLib6StringC1ERKS0_,
          _ZN6TagLib6StringD1Ev: __ZN6TagLib6StringD1Ev,
          _ZN6TagLib6Vorbis10PropertiesD0Ev: __ZN6TagLib6Vorbis10PropertiesD0Ev,
          _ZN6TagLib6Vorbis10PropertiesD1Ev: __ZN6TagLib6Vorbis10PropertiesD1Ev,
          _ZN6TagLib6Vorbis4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib6Vorbis4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib6Vorbis4File4saveEv: __ZN6TagLib6Vorbis4File4saveEv,
          _ZN6TagLib6Vorbis4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib6Vorbis4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib6Vorbis4FileD0Ev: __ZN6TagLib6Vorbis4FileD0Ev,
          _ZN6TagLib6Vorbis4FileD1Ev: __ZN6TagLib6Vorbis4FileD1Ev,
          _ZN6TagLib7FileRef13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib7FileRef13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib7FileRef20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE:
            __ZN6TagLib7FileRef20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE,
          _ZN6TagLib7FileRef4saveEv: __ZN6TagLib7FileRef4saveEv,
          _ZN6TagLib7FileRefC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib7FileRefC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib7FileRefC1EPNS_4FileE: __ZN6TagLib7FileRefC1EPNS_4FileE,
          _ZN6TagLib7FileRefC1EPNS_8IOStreamEbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib7FileRefC1EPNS_8IOStreamEbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib7FileRefD1Ev: __ZN6TagLib7FileRefD1Ev,
          _ZN6TagLib7VariantC1EPKc: __ZN6TagLib7VariantC1EPKc,
          _ZN6TagLib7VariantC1ERKNS_10ByteVectorE:
            __ZN6TagLib7VariantC1ERKNS_10ByteVectorE,
          _ZN6TagLib7VariantC1ERKNS_10StringListE:
            __ZN6TagLib7VariantC1ERKNS_10StringListE,
          _ZN6TagLib7VariantC1ERKS0_: __ZN6TagLib7VariantC1ERKS0_,
          _ZN6TagLib7VariantC1Eb: __ZN6TagLib7VariantC1Eb,
          _ZN6TagLib7VariantC1Ed: __ZN6TagLib7VariantC1Ed,
          _ZN6TagLib7VariantC1Ei: __ZN6TagLib7VariantC1Ei,
          _ZN6TagLib7VariantC1Ej: __ZN6TagLib7VariantC1Ej,
          _ZN6TagLib7VariantC1Ev: __ZN6TagLib7VariantC1Ev,
          _ZN6TagLib7VariantC1Ex: __ZN6TagLib7VariantC1Ex,
          _ZN6TagLib7VariantC1Ey: __ZN6TagLib7VariantC1Ey,
          _ZN6TagLib7VariantD1Ev: __ZN6TagLib7VariantD1Ev,
          _ZN6TagLib7VariantaSERKS0_: __ZN6TagLib7VariantaSERKS0_,
          _ZN6TagLib7WavPack10PropertiesD0Ev:
            __ZN6TagLib7WavPack10PropertiesD0Ev,
          _ZN6TagLib7WavPack10PropertiesD1Ev:
            __ZN6TagLib7WavPack10PropertiesD1Ev,
          _ZN6TagLib7WavPack4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib7WavPack4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib7WavPack4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib7WavPack4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib7WavPack4File4saveEv: __ZN6TagLib7WavPack4File4saveEv,
          _ZN6TagLib7WavPack4FileC1EPKcbNS_15AudioProperties9ReadStyleE:
            __ZN6TagLib7WavPack4FileC1EPKcbNS_15AudioProperties9ReadStyleE,
          _ZN6TagLib7WavPack4FileD0Ev: __ZN6TagLib7WavPack4FileD0Ev,
          _ZN6TagLib7WavPack4FileD1Ev: __ZN6TagLib7WavPack4FileD1Ev,
          _ZN6TagLib8IOStream5clearEv: __ZN6TagLib8IOStream5clearEv,
          _ZN6TagLib8IOStreamD0Ev: __ZN6TagLib8IOStreamD0Ev,
          _ZN6TagLib8IOStreamD1Ev: __ZN6TagLib8IOStreamD1Ev,
          _ZN6TagLib8TagUnion10setCommentERKNS_6StringE:
            __ZN6TagLib8TagUnion10setCommentERKNS_6StringE,
          _ZN6TagLib8TagUnion20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE:
            __ZN6TagLib8TagUnion20setComplexPropertiesERKNS_6StringERKNS_4ListINS_3MapIS1_NS_7VariantEEEEE,
          _ZN6TagLib8TagUnion27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib8TagUnion27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib8TagUnion7setYearEj: __ZN6TagLib8TagUnion7setYearEj,
          _ZN6TagLib8TagUnion8setAlbumERKNS_6StringE:
            __ZN6TagLib8TagUnion8setAlbumERKNS_6StringE,
          _ZN6TagLib8TagUnion8setGenreERKNS_6StringE:
            __ZN6TagLib8TagUnion8setGenreERKNS_6StringE,
          _ZN6TagLib8TagUnion8setTitleERKNS_6StringE:
            __ZN6TagLib8TagUnion8setTitleERKNS_6StringE,
          _ZN6TagLib8TagUnion8setTrackEj: __ZN6TagLib8TagUnion8setTrackEj,
          _ZN6TagLib8TagUnion9setArtistERKNS_6StringE:
            __ZN6TagLib8TagUnion9setArtistERKNS_6StringE,
          _ZN6TagLib8TagUnionD0Ev: __ZN6TagLib8TagUnionD0Ev,
          _ZN6TagLib8TagUnionD1Ev: __ZN6TagLib8TagUnionD1Ev,
          _ZN6TagLib9TrueAudio10PropertiesD0Ev:
            __ZN6TagLib9TrueAudio10PropertiesD0Ev,
          _ZN6TagLib9TrueAudio10PropertiesD1Ev:
            __ZN6TagLib9TrueAudio10PropertiesD1Ev,
          _ZN6TagLib9TrueAudio4File13setPropertiesERKNS_11PropertyMapE:
            __ZN6TagLib9TrueAudio4File13setPropertiesERKNS_11PropertyMapE,
          _ZN6TagLib9TrueAudio4File27removeUnsupportedPropertiesERKNS_10StringListE:
            __ZN6TagLib9TrueAudio4File27removeUnsupportedPropertiesERKNS_10StringListE,
          _ZN6TagLib9TrueAudio4File4saveEv: __ZN6TagLib9TrueAudio4File4saveEv,
          _ZN6TagLib9TrueAudio4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE:
            __ZN6TagLib9TrueAudio4FileC1EPKcbNS_15AudioProperties9ReadStyleEPNS_5ID3v212FrameFactoryE,
          _ZN6TagLib9TrueAudio4FileD0Ev: __ZN6TagLib9TrueAudio4FileD0Ev,
          _ZN6TagLib9TrueAudio4FileD1Ev: __ZN6TagLib9TrueAudio4FileD1Ev,
          _ZNK4utf812invalid_utf84whatEv: __ZNK4utf812invalid_utf84whatEv,
          _ZNK4utf813invalid_utf164whatEv: __ZNK4utf813invalid_utf164whatEv,
          _ZNK4utf815not_enough_room4whatEv: __ZNK4utf815not_enough_room4whatEv,
          _ZNK4utf818invalid_code_point4whatEv:
            __ZNK4utf818invalid_code_point4whatEv,
          _ZNK6TagLib10ByteVector4dataEv: __ZNK6TagLib10ByteVector4dataEv,
          _ZNK6TagLib10ByteVector4sizeEv: __ZNK6TagLib10ByteVector4sizeEv,
          _ZNK6TagLib10FileStream4nameEv: __ZNK6TagLib10FileStream4nameEv,
          _ZNK6TagLib10FileStream4tellEv: __ZNK6TagLib10FileStream4tellEv,
          _ZNK6TagLib10FileStream6isOpenEv: __ZNK6TagLib10FileStream6isOpenEv,
          _ZNK6TagLib10FileStream8readOnlyEv:
            __ZNK6TagLib10FileStream8readOnlyEv,
          _ZNK6TagLib11PropertyMap4findERKNS_6StringE:
            __ZNK6TagLib11PropertyMap4findERKNS_6StringE,
          _ZNK6TagLib15AudioProperties10sampleRateEv:
            __ZNK6TagLib15AudioProperties10sampleRateEv,
          _ZNK6TagLib15AudioProperties15lengthInSecondsEv:
            __ZNK6TagLib15AudioProperties15lengthInSecondsEv,
          _ZNK6TagLib15AudioProperties20lengthInMillisecondsEv:
            __ZNK6TagLib15AudioProperties20lengthInMillisecondsEv,
          _ZNK6TagLib15AudioProperties6lengthEv:
            __ZNK6TagLib15AudioProperties6lengthEv,
          _ZNK6TagLib15AudioProperties7bitrateEv:
            __ZNK6TagLib15AudioProperties7bitrateEv,
          _ZNK6TagLib16ByteVectorStream4nameEv:
            __ZNK6TagLib16ByteVectorStream4nameEv,
          _ZNK6TagLib16ByteVectorStream4tellEv:
            __ZNK6TagLib16ByteVectorStream4tellEv,
          _ZNK6TagLib16ByteVectorStream6isOpenEv:
            __ZNK6TagLib16ByteVectorStream6isOpenEv,
          _ZNK6TagLib16ByteVectorStream8readOnlyEv:
            __ZNK6TagLib16ByteVectorStream8readOnlyEv,
          _ZNK6TagLib2IT10Properties8channelsEv:
            __ZNK6TagLib2IT10Properties8channelsEv,
          _ZNK6TagLib2IT4File15audioPropertiesEv:
            __ZNK6TagLib2IT4File15audioPropertiesEv,
          _ZNK6TagLib2IT4File3tagEv: __ZNK6TagLib2IT4File3tagEv,
          _ZNK6TagLib2XM10Properties8channelsEv:
            __ZNK6TagLib2XM10Properties8channelsEv,
          _ZNK6TagLib2XM4File10propertiesEv: __ZNK6TagLib2XM4File10propertiesEv,
          _ZNK6TagLib2XM4File15audioPropertiesEv:
            __ZNK6TagLib2XM4File15audioPropertiesEv,
          _ZNK6TagLib2XM4File3tagEv: __ZNK6TagLib2XM4File3tagEv,
          _ZNK6TagLib3APE10Properties10sampleRateEv:
            __ZNK6TagLib3APE10Properties10sampleRateEv,
          _ZNK6TagLib3APE10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib3APE10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib3APE10Properties7bitrateEv:
            __ZNK6TagLib3APE10Properties7bitrateEv,
          _ZNK6TagLib3APE10Properties8channelsEv:
            __ZNK6TagLib3APE10Properties8channelsEv,
          _ZNK6TagLib3APE3Tag10propertiesEv: __ZNK6TagLib3APE3Tag10propertiesEv,
          _ZNK6TagLib3APE3Tag17complexPropertiesERKNS_6StringE:
            __ZNK6TagLib3APE3Tag17complexPropertiesERKNS_6StringE,
          _ZNK6TagLib3APE3Tag19complexPropertyKeysEv:
            __ZNK6TagLib3APE3Tag19complexPropertyKeysEv,
          _ZNK6TagLib3APE3Tag4yearEv: __ZNK6TagLib3APE3Tag4yearEv,
          _ZNK6TagLib3APE3Tag5albumEv: __ZNK6TagLib3APE3Tag5albumEv,
          _ZNK6TagLib3APE3Tag5genreEv: __ZNK6TagLib3APE3Tag5genreEv,
          _ZNK6TagLib3APE3Tag5titleEv: __ZNK6TagLib3APE3Tag5titleEv,
          _ZNK6TagLib3APE3Tag5trackEv: __ZNK6TagLib3APE3Tag5trackEv,
          _ZNK6TagLib3APE3Tag6artistEv: __ZNK6TagLib3APE3Tag6artistEv,
          _ZNK6TagLib3APE3Tag7commentEv: __ZNK6TagLib3APE3Tag7commentEv,
          _ZNK6TagLib3APE3Tag7isEmptyEv: __ZNK6TagLib3APE3Tag7isEmptyEv,
          _ZNK6TagLib3APE4File10propertiesEv:
            __ZNK6TagLib3APE4File10propertiesEv,
          _ZNK6TagLib3APE4File15audioPropertiesEv:
            __ZNK6TagLib3APE4File15audioPropertiesEv,
          _ZNK6TagLib3APE4File3tagEv: __ZNK6TagLib3APE4File3tagEv,
          _ZNK6TagLib3ASF10Properties10sampleRateEv:
            __ZNK6TagLib3ASF10Properties10sampleRateEv,
          _ZNK6TagLib3ASF10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib3ASF10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib3ASF10Properties7bitrateEv:
            __ZNK6TagLib3ASF10Properties7bitrateEv,
          _ZNK6TagLib3ASF10Properties8channelsEv:
            __ZNK6TagLib3ASF10Properties8channelsEv,
          _ZNK6TagLib3ASF3Tag10propertiesEv: __ZNK6TagLib3ASF3Tag10propertiesEv,
          _ZNK6TagLib3ASF3Tag17complexPropertiesERKNS_6StringE:
            __ZNK6TagLib3ASF3Tag17complexPropertiesERKNS_6StringE,
          _ZNK6TagLib3ASF3Tag19complexPropertyKeysEv:
            __ZNK6TagLib3ASF3Tag19complexPropertyKeysEv,
          _ZNK6TagLib3ASF3Tag4yearEv: __ZNK6TagLib3ASF3Tag4yearEv,
          _ZNK6TagLib3ASF3Tag5albumEv: __ZNK6TagLib3ASF3Tag5albumEv,
          _ZNK6TagLib3ASF3Tag5genreEv: __ZNK6TagLib3ASF3Tag5genreEv,
          _ZNK6TagLib3ASF3Tag5titleEv: __ZNK6TagLib3ASF3Tag5titleEv,
          _ZNK6TagLib3ASF3Tag5trackEv: __ZNK6TagLib3ASF3Tag5trackEv,
          _ZNK6TagLib3ASF3Tag6artistEv: __ZNK6TagLib3ASF3Tag6artistEv,
          _ZNK6TagLib3ASF3Tag6ratingEv: __ZNK6TagLib3ASF3Tag6ratingEv,
          _ZNK6TagLib3ASF3Tag7commentEv: __ZNK6TagLib3ASF3Tag7commentEv,
          _ZNK6TagLib3ASF3Tag7isEmptyEv: __ZNK6TagLib3ASF3Tag7isEmptyEv,
          _ZNK6TagLib3ASF3Tag9copyrightEv: __ZNK6TagLib3ASF3Tag9copyrightEv,
          _ZNK6TagLib3ASF4File10propertiesEv:
            __ZNK6TagLib3ASF4File10propertiesEv,
          _ZNK6TagLib3ASF4File11FilePrivate13UnknownObject4guidEv:
            __ZNK6TagLib3ASF4File11FilePrivate13UnknownObject4guidEv,
          _ZNK6TagLib3ASF4File11FilePrivate14MetadataObject4guidEv:
            __ZNK6TagLib3ASF4File11FilePrivate14MetadataObject4guidEv,
          _ZNK6TagLib3ASF4File11FilePrivate15CodecListObject4guidEv:
            __ZNK6TagLib3ASF4File11FilePrivate15CodecListObject4guidEv,
          _ZNK6TagLib3ASF4File11FilePrivate20FilePropertiesObject4guidEv:
            __ZNK6TagLib3ASF4File11FilePrivate20FilePropertiesObject4guidEv,
          _ZNK6TagLib3ASF4File11FilePrivate21HeaderExtensionObject4guidEv:
            __ZNK6TagLib3ASF4File11FilePrivate21HeaderExtensionObject4guidEv,
          _ZNK6TagLib3ASF4File11FilePrivate21MetadataLibraryObject4guidEv:
            __ZNK6TagLib3ASF4File11FilePrivate21MetadataLibraryObject4guidEv,
          _ZNK6TagLib3ASF4File11FilePrivate22StreamPropertiesObject4guidEv:
            __ZNK6TagLib3ASF4File11FilePrivate22StreamPropertiesObject4guidEv,
          _ZNK6TagLib3ASF4File11FilePrivate24ContentDescriptionObject4guidEv:
            __ZNK6TagLib3ASF4File11FilePrivate24ContentDescriptionObject4guidEv,
          _ZNK6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject4guidEv:
            __ZNK6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObject4guidEv,
          _ZNK6TagLib3ASF4File15audioPropertiesEv:
            __ZNK6TagLib3ASF4File15audioPropertiesEv,
          _ZNK6TagLib3ASF4File3tagEv: __ZNK6TagLib3ASF4File3tagEv,
          _ZNK6TagLib3DSF10Properties10sampleRateEv:
            __ZNK6TagLib3DSF10Properties10sampleRateEv,
          _ZNK6TagLib3DSF10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib3DSF10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib3DSF10Properties7bitrateEv:
            __ZNK6TagLib3DSF10Properties7bitrateEv,
          _ZNK6TagLib3DSF10Properties8channelsEv:
            __ZNK6TagLib3DSF10Properties8channelsEv,
          _ZNK6TagLib3DSF4File10propertiesEv:
            __ZNK6TagLib3DSF4File10propertiesEv,
          _ZNK6TagLib3DSF4File15audioPropertiesEv:
            __ZNK6TagLib3DSF4File15audioPropertiesEv,
          _ZNK6TagLib3DSF4File3tagEv: __ZNK6TagLib3DSF4File3tagEv,
          _ZNK6TagLib3MP410Properties10sampleRateEv:
            __ZNK6TagLib3MP410Properties10sampleRateEv,
          _ZNK6TagLib3MP410Properties13bitsPerSampleEv:
            __ZNK6TagLib3MP410Properties13bitsPerSampleEv,
          _ZNK6TagLib3MP410Properties20lengthInMillisecondsEv:
            __ZNK6TagLib3MP410Properties20lengthInMillisecondsEv,
          _ZNK6TagLib3MP410Properties7bitrateEv:
            __ZNK6TagLib3MP410Properties7bitrateEv,
          _ZNK6TagLib3MP410Properties8channelsEv:
            __ZNK6TagLib3MP410Properties8channelsEv,
          _ZNK6TagLib3MP411ItemFactory10renderItemERKNS_6StringERKNS0_4ItemE:
            __ZNK6TagLib3MP411ItemFactory10renderItemERKNS_6StringERKNS0_4ItemE,
          _ZNK6TagLib3MP411ItemFactory14itemToPropertyERKNS_10ByteVectorERKNS0_4ItemE:
            __ZNK6TagLib3MP411ItemFactory14itemToPropertyERKNS_10ByteVectorERKNS0_4ItemE,
          _ZNK6TagLib3MP411ItemFactory14nameHandlerMapEv:
            __ZNK6TagLib3MP411ItemFactory14nameHandlerMapEv,
          _ZNK6TagLib3MP411ItemFactory15namePropertyMapEv:
            __ZNK6TagLib3MP411ItemFactory15namePropertyMapEv,
          _ZNK6TagLib3MP411ItemFactory16itemFromPropertyERKNS_6StringERKNS_10StringListE:
            __ZNK6TagLib3MP411ItemFactory16itemFromPropertyERKNS_6StringERKNS_10StringListE,
          _ZNK6TagLib3MP411ItemFactory18handlerTypeForNameERKNS_10ByteVectorE:
            __ZNK6TagLib3MP411ItemFactory18handlerTypeForNameERKNS_10ByteVectorE,
          _ZNK6TagLib3MP411ItemFactory18nameForPropertyKeyERKNS_6StringE:
            __ZNK6TagLib3MP411ItemFactory18nameForPropertyKeyERKNS_6StringE,
          _ZNK6TagLib3MP411ItemFactory18propertyKeyForNameERKNS_10ByteVectorE:
            __ZNK6TagLib3MP411ItemFactory18propertyKeyForNameERKNS_10ByteVectorE,
          _ZNK6TagLib3MP411ItemFactory9parseItemEPKNS0_4AtomERKNS_10ByteVectorE:
            __ZNK6TagLib3MP411ItemFactory9parseItemEPKNS0_4AtomERKNS_10ByteVectorE,
          _ZNK6TagLib3MP43Tag10propertiesEv: __ZNK6TagLib3MP43Tag10propertiesEv,
          _ZNK6TagLib3MP43Tag17complexPropertiesERKNS_6StringE:
            __ZNK6TagLib3MP43Tag17complexPropertiesERKNS_6StringE,
          _ZNK6TagLib3MP43Tag19complexPropertyKeysEv:
            __ZNK6TagLib3MP43Tag19complexPropertyKeysEv,
          _ZNK6TagLib3MP43Tag4yearEv: __ZNK6TagLib3MP43Tag4yearEv,
          _ZNK6TagLib3MP43Tag5albumEv: __ZNK6TagLib3MP43Tag5albumEv,
          _ZNK6TagLib3MP43Tag5genreEv: __ZNK6TagLib3MP43Tag5genreEv,
          _ZNK6TagLib3MP43Tag5titleEv: __ZNK6TagLib3MP43Tag5titleEv,
          _ZNK6TagLib3MP43Tag5trackEv: __ZNK6TagLib3MP43Tag5trackEv,
          _ZNK6TagLib3MP43Tag6artistEv: __ZNK6TagLib3MP43Tag6artistEv,
          _ZNK6TagLib3MP43Tag7commentEv: __ZNK6TagLib3MP43Tag7commentEv,
          _ZNK6TagLib3MP43Tag7isEmptyEv: __ZNK6TagLib3MP43Tag7isEmptyEv,
          _ZNK6TagLib3MP44File10propertiesEv:
            __ZNK6TagLib3MP44File10propertiesEv,
          _ZNK6TagLib3MP44File15audioPropertiesEv:
            __ZNK6TagLib3MP44File15audioPropertiesEv,
          _ZNK6TagLib3MP44File3tagEv: __ZNK6TagLib3MP44File3tagEv,
          _ZNK6TagLib3MPC10Properties10sampleRateEv:
            __ZNK6TagLib3MPC10Properties10sampleRateEv,
          _ZNK6TagLib3MPC10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib3MPC10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib3MPC10Properties7bitrateEv:
            __ZNK6TagLib3MPC10Properties7bitrateEv,
          _ZNK6TagLib3MPC10Properties8channelsEv:
            __ZNK6TagLib3MPC10Properties8channelsEv,
          _ZNK6TagLib3MPC4File10propertiesEv:
            __ZNK6TagLib3MPC4File10propertiesEv,
          _ZNK6TagLib3MPC4File15audioPropertiesEv:
            __ZNK6TagLib3MPC4File15audioPropertiesEv,
          _ZNK6TagLib3MPC4File3tagEv: __ZNK6TagLib3MPC4File3tagEv,
          _ZNK6TagLib3MapINS_6StringENS_7VariantEEeqERKS3_:
            __ZNK6TagLib3MapINS_6StringENS_7VariantEEeqERKS3_,
          _ZNK6TagLib3Mod10Properties10sampleRateEv:
            __ZNK6TagLib3Mod10Properties10sampleRateEv,
          _ZNK6TagLib3Mod10Properties7bitrateEv:
            __ZNK6TagLib3Mod10Properties7bitrateEv,
          _ZNK6TagLib3Mod10Properties8channelsEv:
            __ZNK6TagLib3Mod10Properties8channelsEv,
          _ZNK6TagLib3Mod3Tag10propertiesEv: __ZNK6TagLib3Mod3Tag10propertiesEv,
          _ZNK6TagLib3Mod3Tag4yearEv: __ZNK6TagLib3Mod3Tag4yearEv,
          _ZNK6TagLib3Mod3Tag5albumEv: __ZNK6TagLib3Mod3Tag5albumEv,
          _ZNK6TagLib3Mod3Tag5genreEv: __ZNK6TagLib3Mod3Tag5genreEv,
          _ZNK6TagLib3Mod3Tag5titleEv: __ZNK6TagLib3Mod3Tag5titleEv,
          _ZNK6TagLib3Mod3Tag5trackEv: __ZNK6TagLib3Mod3Tag5trackEv,
          _ZNK6TagLib3Mod3Tag6artistEv: __ZNK6TagLib3Mod3Tag6artistEv,
          _ZNK6TagLib3Mod3Tag7commentEv: __ZNK6TagLib3Mod3Tag7commentEv,
          _ZNK6TagLib3Mod4File10propertiesEv:
            __ZNK6TagLib3Mod4File10propertiesEv,
          _ZNK6TagLib3Mod4File15audioPropertiesEv:
            __ZNK6TagLib3Mod4File15audioPropertiesEv,
          _ZNK6TagLib3Mod4File3tagEv: __ZNK6TagLib3Mod4File3tagEv,
          _ZNK6TagLib3Ogg11XiphComment10propertiesEv:
            __ZNK6TagLib3Ogg11XiphComment10propertiesEv,
          _ZNK6TagLib3Ogg11XiphComment17complexPropertiesERKNS_6StringE:
            __ZNK6TagLib3Ogg11XiphComment17complexPropertiesERKNS_6StringE,
          _ZNK6TagLib3Ogg11XiphComment19complexPropertyKeysEv:
            __ZNK6TagLib3Ogg11XiphComment19complexPropertyKeysEv,
          _ZNK6TagLib3Ogg11XiphComment4yearEv:
            __ZNK6TagLib3Ogg11XiphComment4yearEv,
          _ZNK6TagLib3Ogg11XiphComment5albumEv:
            __ZNK6TagLib3Ogg11XiphComment5albumEv,
          _ZNK6TagLib3Ogg11XiphComment5genreEv:
            __ZNK6TagLib3Ogg11XiphComment5genreEv,
          _ZNK6TagLib3Ogg11XiphComment5titleEv:
            __ZNK6TagLib3Ogg11XiphComment5titleEv,
          _ZNK6TagLib3Ogg11XiphComment5trackEv:
            __ZNK6TagLib3Ogg11XiphComment5trackEv,
          _ZNK6TagLib3Ogg11XiphComment6artistEv:
            __ZNK6TagLib3Ogg11XiphComment6artistEv,
          _ZNK6TagLib3Ogg11XiphComment7commentEv:
            __ZNK6TagLib3Ogg11XiphComment7commentEv,
          _ZNK6TagLib3Ogg11XiphComment7isEmptyEv:
            __ZNK6TagLib3Ogg11XiphComment7isEmptyEv,
          _ZNK6TagLib3Ogg4FLAC4File10propertiesEv:
            __ZNK6TagLib3Ogg4FLAC4File10propertiesEv,
          _ZNK6TagLib3Ogg4FLAC4File15audioPropertiesEv:
            __ZNK6TagLib3Ogg4FLAC4File15audioPropertiesEv,
          _ZNK6TagLib3Ogg4FLAC4File3tagEv: __ZNK6TagLib3Ogg4FLAC4File3tagEv,
          _ZNK6TagLib3Ogg4Opus10Properties10sampleRateEv:
            __ZNK6TagLib3Ogg4Opus10Properties10sampleRateEv,
          _ZNK6TagLib3Ogg4Opus10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib3Ogg4Opus10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib3Ogg4Opus10Properties7bitrateEv:
            __ZNK6TagLib3Ogg4Opus10Properties7bitrateEv,
          _ZNK6TagLib3Ogg4Opus10Properties8channelsEv:
            __ZNK6TagLib3Ogg4Opus10Properties8channelsEv,
          _ZNK6TagLib3Ogg4Opus4File10propertiesEv:
            __ZNK6TagLib3Ogg4Opus4File10propertiesEv,
          _ZNK6TagLib3Ogg4Opus4File15audioPropertiesEv:
            __ZNK6TagLib3Ogg4Opus4File15audioPropertiesEv,
          _ZNK6TagLib3Ogg4Opus4File3tagEv: __ZNK6TagLib3Ogg4Opus4File3tagEv,
          _ZNK6TagLib3Ogg5Speex10Properties10sampleRateEv:
            __ZNK6TagLib3Ogg5Speex10Properties10sampleRateEv,
          _ZNK6TagLib3Ogg5Speex10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib3Ogg5Speex10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib3Ogg5Speex10Properties7bitrateEv:
            __ZNK6TagLib3Ogg5Speex10Properties7bitrateEv,
          _ZNK6TagLib3Ogg5Speex10Properties8channelsEv:
            __ZNK6TagLib3Ogg5Speex10Properties8channelsEv,
          _ZNK6TagLib3Ogg5Speex4File10propertiesEv:
            __ZNK6TagLib3Ogg5Speex4File10propertiesEv,
          _ZNK6TagLib3Ogg5Speex4File15audioPropertiesEv:
            __ZNK6TagLib3Ogg5Speex4File15audioPropertiesEv,
          _ZNK6TagLib3Ogg5Speex4File3tagEv: __ZNK6TagLib3Ogg5Speex4File3tagEv,
          _ZNK6TagLib3S3M10Properties8channelsEv:
            __ZNK6TagLib3S3M10Properties8channelsEv,
          _ZNK6TagLib3S3M4File10propertiesEv:
            __ZNK6TagLib3S3M4File10propertiesEv,
          _ZNK6TagLib3S3M4File15audioPropertiesEv:
            __ZNK6TagLib3S3M4File15audioPropertiesEv,
          _ZNK6TagLib3S3M4File3tagEv: __ZNK6TagLib3S3M4File3tagEv,
          _ZNK6TagLib3Tag10propertiesEv: __ZNK6TagLib3Tag10propertiesEv,
          _ZNK6TagLib3Tag17complexPropertiesERKNS_6StringE:
            __ZNK6TagLib3Tag17complexPropertiesERKNS_6StringE,
          _ZNK6TagLib3Tag19complexPropertyKeysEv:
            __ZNK6TagLib3Tag19complexPropertyKeysEv,
          _ZNK6TagLib3Tag7isEmptyEv: __ZNK6TagLib3Tag7isEmptyEv,
          _ZNK6TagLib4FLAC10Properties10sampleRateEv:
            __ZNK6TagLib4FLAC10Properties10sampleRateEv,
          _ZNK6TagLib4FLAC10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib4FLAC10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib4FLAC10Properties7bitrateEv:
            __ZNK6TagLib4FLAC10Properties7bitrateEv,
          _ZNK6TagLib4FLAC10Properties8channelsEv:
            __ZNK6TagLib4FLAC10Properties8channelsEv,
          _ZNK6TagLib4FLAC20UnknownMetadataBlock4codeEv:
            __ZNK6TagLib4FLAC20UnknownMetadataBlock4codeEv,
          _ZNK6TagLib4FLAC20UnknownMetadataBlock6renderEv:
            __ZNK6TagLib4FLAC20UnknownMetadataBlock6renderEv,
          _ZNK6TagLib4FLAC4File10propertiesEv:
            __ZNK6TagLib4FLAC4File10propertiesEv,
          _ZNK6TagLib4FLAC4File15audioPropertiesEv:
            __ZNK6TagLib4FLAC4File15audioPropertiesEv,
          _ZNK6TagLib4FLAC4File17complexPropertiesERKNS_6StringE:
            __ZNK6TagLib4FLAC4File17complexPropertiesERKNS_6StringE,
          _ZNK6TagLib4FLAC4File19complexPropertyKeysEv:
            __ZNK6TagLib4FLAC4File19complexPropertyKeysEv,
          _ZNK6TagLib4FLAC4File3tagEv: __ZNK6TagLib4FLAC4File3tagEv,
          _ZNK6TagLib4FLAC7Picture4codeEv: __ZNK6TagLib4FLAC7Picture4codeEv,
          _ZNK6TagLib4FLAC7Picture6renderEv: __ZNK6TagLib4FLAC7Picture6renderEv,
          _ZNK6TagLib4File10propertiesEv: __ZNK6TagLib4File10propertiesEv,
          _ZNK6TagLib4File17complexPropertiesERKNS_6StringE:
            __ZNK6TagLib4File17complexPropertiesERKNS_6StringE,
          _ZNK6TagLib4File19complexPropertyKeysEv:
            __ZNK6TagLib4File19complexPropertyKeysEv,
          _ZNK6TagLib4MPEG10Properties10sampleRateEv:
            __ZNK6TagLib4MPEG10Properties10sampleRateEv,
          _ZNK6TagLib4MPEG10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib4MPEG10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib4MPEG10Properties7bitrateEv:
            __ZNK6TagLib4MPEG10Properties7bitrateEv,
          _ZNK6TagLib4MPEG10Properties8channelsEv:
            __ZNK6TagLib4MPEG10Properties8channelsEv,
          _ZNK6TagLib4MPEG4File10propertiesEv:
            __ZNK6TagLib4MPEG4File10propertiesEv,
          _ZNK6TagLib4MPEG4File15audioPropertiesEv:
            __ZNK6TagLib4MPEG4File15audioPropertiesEv,
          _ZNK6TagLib4MPEG4File3tagEv: __ZNK6TagLib4MPEG4File3tagEv,
          _ZNK6TagLib4RIFF3WAV10Properties10sampleRateEv:
            __ZNK6TagLib4RIFF3WAV10Properties10sampleRateEv,
          _ZNK6TagLib4RIFF3WAV10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib4RIFF3WAV10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib4RIFF3WAV10Properties7bitrateEv:
            __ZNK6TagLib4RIFF3WAV10Properties7bitrateEv,
          _ZNK6TagLib4RIFF3WAV10Properties8channelsEv:
            __ZNK6TagLib4RIFF3WAV10Properties8channelsEv,
          _ZNK6TagLib4RIFF3WAV4File10propertiesEv:
            __ZNK6TagLib4RIFF3WAV4File10propertiesEv,
          _ZNK6TagLib4RIFF3WAV4File15audioPropertiesEv:
            __ZNK6TagLib4RIFF3WAV4File15audioPropertiesEv,
          _ZNK6TagLib4RIFF3WAV4File3tagEv: __ZNK6TagLib4RIFF3WAV4File3tagEv,
          _ZNK6TagLib4RIFF4AIFF10Properties10sampleRateEv:
            __ZNK6TagLib4RIFF4AIFF10Properties10sampleRateEv,
          _ZNK6TagLib4RIFF4AIFF10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib4RIFF4AIFF10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib4RIFF4AIFF10Properties7bitrateEv:
            __ZNK6TagLib4RIFF4AIFF10Properties7bitrateEv,
          _ZNK6TagLib4RIFF4AIFF10Properties8channelsEv:
            __ZNK6TagLib4RIFF4AIFF10Properties8channelsEv,
          _ZNK6TagLib4RIFF4AIFF4File10propertiesEv:
            __ZNK6TagLib4RIFF4AIFF4File10propertiesEv,
          _ZNK6TagLib4RIFF4AIFF4File15audioPropertiesEv:
            __ZNK6TagLib4RIFF4AIFF4File15audioPropertiesEv,
          _ZNK6TagLib4RIFF4AIFF4File3tagEv: __ZNK6TagLib4RIFF4AIFF4File3tagEv,
          _ZNK6TagLib4RIFF4Info13StringHandler5parseERKNS_10ByteVectorE:
            __ZNK6TagLib4RIFF4Info13StringHandler5parseERKNS_10ByteVectorE,
          _ZNK6TagLib4RIFF4Info13StringHandler6renderERKNS_6StringE:
            __ZNK6TagLib4RIFF4Info13StringHandler6renderERKNS_6StringE,
          _ZNK6TagLib4RIFF4Info3Tag10propertiesEv:
            __ZNK6TagLib4RIFF4Info3Tag10propertiesEv,
          _ZNK6TagLib4RIFF4Info3Tag4yearEv: __ZNK6TagLib4RIFF4Info3Tag4yearEv,
          _ZNK6TagLib4RIFF4Info3Tag5albumEv: __ZNK6TagLib4RIFF4Info3Tag5albumEv,
          _ZNK6TagLib4RIFF4Info3Tag5genreEv: __ZNK6TagLib4RIFF4Info3Tag5genreEv,
          _ZNK6TagLib4RIFF4Info3Tag5titleEv: __ZNK6TagLib4RIFF4Info3Tag5titleEv,
          _ZNK6TagLib4RIFF4Info3Tag5trackEv: __ZNK6TagLib4RIFF4Info3Tag5trackEv,
          _ZNK6TagLib4RIFF4Info3Tag6artistEv:
            __ZNK6TagLib4RIFF4Info3Tag6artistEv,
          _ZNK6TagLib4RIFF4Info3Tag7commentEv:
            __ZNK6TagLib4RIFF4Info3Tag7commentEv,
          _ZNK6TagLib4RIFF4Info3Tag7isEmptyEv:
            __ZNK6TagLib4RIFF4Info3Tag7isEmptyEv,
          _ZNK6TagLib5ID3v113StringHandler5parseERKNS_10ByteVectorE:
            __ZNK6TagLib5ID3v113StringHandler5parseERKNS_10ByteVectorE,
          _ZNK6TagLib5ID3v113StringHandler6renderERKNS_6StringE:
            __ZNK6TagLib5ID3v113StringHandler6renderERKNS_6StringE,
          _ZNK6TagLib5ID3v13Tag4yearEv: __ZNK6TagLib5ID3v13Tag4yearEv,
          _ZNK6TagLib5ID3v13Tag5albumEv: __ZNK6TagLib5ID3v13Tag5albumEv,
          _ZNK6TagLib5ID3v13Tag5genreEv: __ZNK6TagLib5ID3v13Tag5genreEv,
          _ZNK6TagLib5ID3v13Tag5titleEv: __ZNK6TagLib5ID3v13Tag5titleEv,
          _ZNK6TagLib5ID3v13Tag5trackEv: __ZNK6TagLib5ID3v13Tag5trackEv,
          _ZNK6TagLib5ID3v13Tag6artistEv: __ZNK6TagLib5ID3v13Tag6artistEv,
          _ZNK6TagLib5ID3v13Tag7commentEv: __ZNK6TagLib5ID3v13Tag7commentEv,
          _ZNK6TagLib5ID3v212ChapterFrame12asPropertiesEv:
            __ZNK6TagLib5ID3v212ChapterFrame12asPropertiesEv,
          _ZNK6TagLib5ID3v212ChapterFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v212ChapterFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v212ChapterFrame8toStringEv:
            __ZNK6TagLib5ID3v212ChapterFrame8toStringEv,
          _ZNK6TagLib5ID3v212FrameFactory11createFrameERKNS_10ByteVectorEPKNS0_6HeaderE:
            __ZNK6TagLib5ID3v212FrameFactory11createFrameERKNS_10ByteVectorEPKNS0_6HeaderE,
          _ZNK6TagLib5ID3v212FrameFactory11createFrameERKNS_10ByteVectorEPNS0_5Frame6HeaderEPKNS0_6HeaderE:
            __ZNK6TagLib5ID3v212FrameFactory11createFrameERKNS_10ByteVectorEPNS0_5Frame6HeaderEPKNS0_6HeaderE,
          _ZNK6TagLib5ID3v212FrameFactory11updateFrameEPNS0_5Frame6HeaderE:
            __ZNK6TagLib5ID3v212FrameFactory11updateFrameEPNS0_5Frame6HeaderE,
          _ZNK6TagLib5ID3v212FrameFactory22createFrameForPropertyERKNS_6StringERKNS_10StringListE:
            __ZNK6TagLib5ID3v212FrameFactory22createFrameForPropertyERKNS_6StringERKNS_10StringListE,
          _ZNK6TagLib5ID3v212FrameFactory22rebuildAggregateFramesEPNS0_3TagE:
            __ZNK6TagLib5ID3v212FrameFactory22rebuildAggregateFramesEPNS0_3TagE,
          _ZNK6TagLib5ID3v212PodcastFrame12asPropertiesEv:
            __ZNK6TagLib5ID3v212PodcastFrame12asPropertiesEv,
          _ZNK6TagLib5ID3v212PodcastFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v212PodcastFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v212PodcastFrame8toStringEv:
            __ZNK6TagLib5ID3v212PodcastFrame8toStringEv,
          _ZNK6TagLib5ID3v212PrivateFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v212PrivateFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v212PrivateFrame8toStringEv:
            __ZNK6TagLib5ID3v212PrivateFrame8toStringEv,
          _ZNK6TagLib5ID3v212UnknownFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v212UnknownFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v212UnknownFrame8toStringEv:
            __ZNK6TagLib5ID3v212UnknownFrame8toStringEv,
          _ZNK6TagLib5ID3v212UrlLinkFrame12asPropertiesEv:
            __ZNK6TagLib5ID3v212UrlLinkFrame12asPropertiesEv,
          _ZNK6TagLib5ID3v212UrlLinkFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v212UrlLinkFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v212UrlLinkFrame3urlEv:
            __ZNK6TagLib5ID3v212UrlLinkFrame3urlEv,
          _ZNK6TagLib5ID3v212UrlLinkFrame8toStringEv:
            __ZNK6TagLib5ID3v212UrlLinkFrame8toStringEv,
          _ZNK6TagLib5ID3v213CommentsFrame12asPropertiesEv:
            __ZNK6TagLib5ID3v213CommentsFrame12asPropertiesEv,
          _ZNK6TagLib5ID3v213CommentsFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v213CommentsFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v213CommentsFrame8toStringEv:
            __ZNK6TagLib5ID3v213CommentsFrame8toStringEv,
          _ZNK6TagLib5ID3v214OwnershipFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v214OwnershipFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v214OwnershipFrame12toStringListEv:
            __ZNK6TagLib5ID3v214OwnershipFrame12toStringListEv,
          _ZNK6TagLib5ID3v214OwnershipFrame8toStringEv:
            __ZNK6TagLib5ID3v214OwnershipFrame8toStringEv,
          _ZNK6TagLib5ID3v216UserUrlLinkFrame12asPropertiesEv:
            __ZNK6TagLib5ID3v216UserUrlLinkFrame12asPropertiesEv,
          _ZNK6TagLib5ID3v216UserUrlLinkFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v216UserUrlLinkFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v216UserUrlLinkFrame8toStringEv:
            __ZNK6TagLib5ID3v216UserUrlLinkFrame8toStringEv,
          _ZNK6TagLib5ID3v218PopularimeterFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v218PopularimeterFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v218PopularimeterFrame12toStringListEv:
            __ZNK6TagLib5ID3v218PopularimeterFrame12toStringListEv,
          _ZNK6TagLib5ID3v218PopularimeterFrame8toStringEv:
            __ZNK6TagLib5ID3v218PopularimeterFrame8toStringEv,
          _ZNK6TagLib5ID3v219Latin1StringHandler5parseERKNS_10ByteVectorE:
            __ZNK6TagLib5ID3v219Latin1StringHandler5parseERKNS_10ByteVectorE,
          _ZNK6TagLib5ID3v219RelativeVolumeFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v219RelativeVolumeFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v219RelativeVolumeFrame8toStringEv:
            __ZNK6TagLib5ID3v219RelativeVolumeFrame8toStringEv,
          _ZNK6TagLib5ID3v220AttachedPictureFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v220AttachedPictureFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v220AttachedPictureFrame12toStringListEv:
            __ZNK6TagLib5ID3v220AttachedPictureFrame12toStringListEv,
          _ZNK6TagLib5ID3v220AttachedPictureFrame8toStringEv:
            __ZNK6TagLib5ID3v220AttachedPictureFrame8toStringEv,
          _ZNK6TagLib5ID3v220TableOfContentsFrame12asPropertiesEv:
            __ZNK6TagLib5ID3v220TableOfContentsFrame12asPropertiesEv,
          _ZNK6TagLib5ID3v220TableOfContentsFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v220TableOfContentsFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v220TableOfContentsFrame8toStringEv:
            __ZNK6TagLib5ID3v220TableOfContentsFrame8toStringEv,
          _ZNK6TagLib5ID3v221EventTimingCodesFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v221EventTimingCodesFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v221EventTimingCodesFrame8toStringEv:
            __ZNK6TagLib5ID3v221EventTimingCodesFrame8toStringEv,
          _ZNK6TagLib5ID3v223SynchronizedLyricsFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v223SynchronizedLyricsFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v223SynchronizedLyricsFrame8toStringEv:
            __ZNK6TagLib5ID3v223SynchronizedLyricsFrame8toStringEv,
          _ZNK6TagLib5ID3v223TextIdentificationFrame12asPropertiesEv:
            __ZNK6TagLib5ID3v223TextIdentificationFrame12asPropertiesEv,
          _ZNK6TagLib5ID3v223TextIdentificationFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v223TextIdentificationFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v223TextIdentificationFrame12toStringListEv:
            __ZNK6TagLib5ID3v223TextIdentificationFrame12toStringListEv,
          _ZNK6TagLib5ID3v223TextIdentificationFrame8toStringEv:
            __ZNK6TagLib5ID3v223TextIdentificationFrame8toStringEv,
          _ZNK6TagLib5ID3v225UniqueFileIdentifierFrame12asPropertiesEv:
            __ZNK6TagLib5ID3v225UniqueFileIdentifierFrame12asPropertiesEv,
          _ZNK6TagLib5ID3v225UniqueFileIdentifierFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v225UniqueFileIdentifierFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v225UniqueFileIdentifierFrame8toStringEv:
            __ZNK6TagLib5ID3v225UniqueFileIdentifierFrame8toStringEv,
          _ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame12asPropertiesEv:
            __ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame12asPropertiesEv,
          _ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame8toStringEv:
            __ZNK6TagLib5ID3v225UnsynchronizedLyricsFrame8toStringEv,
          _ZNK6TagLib5ID3v227UserTextIdentificationFrame12asPropertiesEv:
            __ZNK6TagLib5ID3v227UserTextIdentificationFrame12asPropertiesEv,
          _ZNK6TagLib5ID3v227UserTextIdentificationFrame8toStringEv:
            __ZNK6TagLib5ID3v227UserTextIdentificationFrame8toStringEv,
          _ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame12renderFieldsEv:
            __ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame12renderFieldsEv,
          _ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame12toStringListEv:
            __ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame12toStringListEv,
          _ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame8toStringEv:
            __ZNK6TagLib5ID3v230GeneralEncapsulatedObjectFrame8toStringEv,
          _ZNK6TagLib5ID3v23Tag10propertiesEv:
            __ZNK6TagLib5ID3v23Tag10propertiesEv,
          _ZNK6TagLib5ID3v23Tag17complexPropertiesERKNS_6StringE:
            __ZNK6TagLib5ID3v23Tag17complexPropertiesERKNS_6StringE,
          _ZNK6TagLib5ID3v23Tag19complexPropertyKeysEv:
            __ZNK6TagLib5ID3v23Tag19complexPropertyKeysEv,
          _ZNK6TagLib5ID3v23Tag4yearEv: __ZNK6TagLib5ID3v23Tag4yearEv,
          _ZNK6TagLib5ID3v23Tag5albumEv: __ZNK6TagLib5ID3v23Tag5albumEv,
          _ZNK6TagLib5ID3v23Tag5genreEv: __ZNK6TagLib5ID3v23Tag5genreEv,
          _ZNK6TagLib5ID3v23Tag5titleEv: __ZNK6TagLib5ID3v23Tag5titleEv,
          _ZNK6TagLib5ID3v23Tag5trackEv: __ZNK6TagLib5ID3v23Tag5trackEv,
          _ZNK6TagLib5ID3v23Tag6artistEv: __ZNK6TagLib5ID3v23Tag6artistEv,
          _ZNK6TagLib5ID3v23Tag7commentEv: __ZNK6TagLib5ID3v23Tag7commentEv,
          _ZNK6TagLib5ID3v23Tag7isEmptyEv: __ZNK6TagLib5ID3v23Tag7isEmptyEv,
          _ZNK6TagLib5ID3v25Frame12asPropertiesEv:
            __ZNK6TagLib5ID3v25Frame12asPropertiesEv,
          _ZNK6TagLib5ID3v25Frame12toStringListEv:
            __ZNK6TagLib5ID3v25Frame12toStringListEv,
          _ZNK6TagLib6DSDIFF10Properties10sampleRateEv:
            __ZNK6TagLib6DSDIFF10Properties10sampleRateEv,
          _ZNK6TagLib6DSDIFF10Properties15lengthInSecondsEv:
            __ZNK6TagLib6DSDIFF10Properties15lengthInSecondsEv,
          _ZNK6TagLib6DSDIFF10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib6DSDIFF10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib6DSDIFF10Properties7bitrateEv:
            __ZNK6TagLib6DSDIFF10Properties7bitrateEv,
          _ZNK6TagLib6DSDIFF10Properties8channelsEv:
            __ZNK6TagLib6DSDIFF10Properties8channelsEv,
          _ZNK6TagLib6DSDIFF4DIIN3Tag10propertiesEv:
            __ZNK6TagLib6DSDIFF4DIIN3Tag10propertiesEv,
          _ZNK6TagLib6DSDIFF4DIIN3Tag4yearEv:
            __ZNK6TagLib6DSDIFF4DIIN3Tag4yearEv,
          _ZNK6TagLib6DSDIFF4DIIN3Tag5albumEv:
            __ZNK6TagLib6DSDIFF4DIIN3Tag5albumEv,
          _ZNK6TagLib6DSDIFF4DIIN3Tag5genreEv:
            __ZNK6TagLib6DSDIFF4DIIN3Tag5genreEv,
          _ZNK6TagLib6DSDIFF4DIIN3Tag5titleEv:
            __ZNK6TagLib6DSDIFF4DIIN3Tag5titleEv,
          _ZNK6TagLib6DSDIFF4DIIN3Tag5trackEv:
            __ZNK6TagLib6DSDIFF4DIIN3Tag5trackEv,
          _ZNK6TagLib6DSDIFF4DIIN3Tag6artistEv:
            __ZNK6TagLib6DSDIFF4DIIN3Tag6artistEv,
          _ZNK6TagLib6DSDIFF4DIIN3Tag7commentEv:
            __ZNK6TagLib6DSDIFF4DIIN3Tag7commentEv,
          _ZNK6TagLib6DSDIFF4File10propertiesEv:
            __ZNK6TagLib6DSDIFF4File10propertiesEv,
          _ZNK6TagLib6DSDIFF4File15audioPropertiesEv:
            __ZNK6TagLib6DSDIFF4File15audioPropertiesEv,
          _ZNK6TagLib6DSDIFF4File3tagEv: __ZNK6TagLib6DSDIFF4File3tagEv,
          _ZNK6TagLib6String4sizeEv: __ZNK6TagLib6String4sizeEv,
          _ZNK6TagLib6String6to8BitEb: __ZNK6TagLib6String6to8BitEb,
          _ZNK6TagLib6StringltERKS0_: __ZNK6TagLib6StringltERKS0_,
          _ZNK6TagLib6Vorbis10Properties10sampleRateEv:
            __ZNK6TagLib6Vorbis10Properties10sampleRateEv,
          _ZNK6TagLib6Vorbis10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib6Vorbis10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib6Vorbis10Properties7bitrateEv:
            __ZNK6TagLib6Vorbis10Properties7bitrateEv,
          _ZNK6TagLib6Vorbis10Properties8channelsEv:
            __ZNK6TagLib6Vorbis10Properties8channelsEv,
          _ZNK6TagLib6Vorbis4File10propertiesEv:
            __ZNK6TagLib6Vorbis4File10propertiesEv,
          _ZNK6TagLib6Vorbis4File15audioPropertiesEv:
            __ZNK6TagLib6Vorbis4File15audioPropertiesEv,
          _ZNK6TagLib6Vorbis4File3tagEv: __ZNK6TagLib6Vorbis4File3tagEv,
          _ZNK6TagLib7FileRef10propertiesEv: __ZNK6TagLib7FileRef10propertiesEv,
          _ZNK6TagLib7FileRef15audioPropertiesEv:
            __ZNK6TagLib7FileRef15audioPropertiesEv,
          _ZNK6TagLib7FileRef17complexPropertiesERKNS_6StringE:
            __ZNK6TagLib7FileRef17complexPropertiesERKNS_6StringE,
          _ZNK6TagLib7FileRef19complexPropertyKeysEv:
            __ZNK6TagLib7FileRef19complexPropertyKeysEv,
          _ZNK6TagLib7FileRef3tagEv: __ZNK6TagLib7FileRef3tagEv,
          _ZNK6TagLib7FileRef6isNullEv: __ZNK6TagLib7FileRef6isNullEv,
          _ZNK6TagLib7Variant4typeEv: __ZNK6TagLib7Variant4typeEv,
          _ZNK6TagLib7Variant5valueINS_10ByteVectorEEET_Pb:
            __ZNK6TagLib7Variant5valueINS_10ByteVectorEEET_Pb,
          _ZNK6TagLib7Variant5valueINS_10StringListEEET_Pb:
            __ZNK6TagLib7Variant5valueINS_10StringListEEET_Pb,
          _ZNK6TagLib7Variant5valueINS_14ByteVectorListEEET_Pb:
            __ZNK6TagLib7Variant5valueINS_14ByteVectorListEEET_Pb,
          _ZNK6TagLib7Variant5valueINS_3MapINS_6StringES0_EEEET_Pb:
            __ZNK6TagLib7Variant5valueINS_3MapINS_6StringES0_EEEET_Pb,
          _ZNK6TagLib7Variant5valueINS_4ListIS0_EEEET_Pb:
            __ZNK6TagLib7Variant5valueINS_4ListIS0_EEEET_Pb,
          _ZNK6TagLib7Variant5valueINS_6StringEEET_Pb:
            __ZNK6TagLib7Variant5valueINS_6StringEEET_Pb,
          _ZNK6TagLib7Variant5valueIbEET_Pb: __ZNK6TagLib7Variant5valueIbEET_Pb,
          _ZNK6TagLib7Variant5valueIdEET_Pb: __ZNK6TagLib7Variant5valueIdEET_Pb,
          _ZNK6TagLib7Variant5valueIiEET_Pb: __ZNK6TagLib7Variant5valueIiEET_Pb,
          _ZNK6TagLib7Variant5valueIjEET_Pb: __ZNK6TagLib7Variant5valueIjEET_Pb,
          _ZNK6TagLib7Variant5valueIxEET_Pb: __ZNK6TagLib7Variant5valueIxEET_Pb,
          _ZNK6TagLib7Variant5valueIyEET_Pb: __ZNK6TagLib7Variant5valueIyEET_Pb,
          _ZNK6TagLib7WavPack10Properties10sampleRateEv:
            __ZNK6TagLib7WavPack10Properties10sampleRateEv,
          _ZNK6TagLib7WavPack10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib7WavPack10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib7WavPack10Properties7bitrateEv:
            __ZNK6TagLib7WavPack10Properties7bitrateEv,
          _ZNK6TagLib7WavPack10Properties8channelsEv:
            __ZNK6TagLib7WavPack10Properties8channelsEv,
          _ZNK6TagLib7WavPack4File10propertiesEv:
            __ZNK6TagLib7WavPack4File10propertiesEv,
          _ZNK6TagLib7WavPack4File15audioPropertiesEv:
            __ZNK6TagLib7WavPack4File15audioPropertiesEv,
          _ZNK6TagLib7WavPack4File3tagEv: __ZNK6TagLib7WavPack4File3tagEv,
          _ZNK6TagLib8TagUnion10propertiesEv:
            __ZNK6TagLib8TagUnion10propertiesEv,
          _ZNK6TagLib8TagUnion17complexPropertiesERKNS_6StringE:
            __ZNK6TagLib8TagUnion17complexPropertiesERKNS_6StringE,
          _ZNK6TagLib8TagUnion19complexPropertyKeysEv:
            __ZNK6TagLib8TagUnion19complexPropertyKeysEv,
          _ZNK6TagLib8TagUnion4yearEv: __ZNK6TagLib8TagUnion4yearEv,
          _ZNK6TagLib8TagUnion5albumEv: __ZNK6TagLib8TagUnion5albumEv,
          _ZNK6TagLib8TagUnion5genreEv: __ZNK6TagLib8TagUnion5genreEv,
          _ZNK6TagLib8TagUnion5titleEv: __ZNK6TagLib8TagUnion5titleEv,
          _ZNK6TagLib8TagUnion5trackEv: __ZNK6TagLib8TagUnion5trackEv,
          _ZNK6TagLib8TagUnion6artistEv: __ZNK6TagLib8TagUnion6artistEv,
          _ZNK6TagLib8TagUnion7commentEv: __ZNK6TagLib8TagUnion7commentEv,
          _ZNK6TagLib8TagUnion7isEmptyEv: __ZNK6TagLib8TagUnion7isEmptyEv,
          _ZNK6TagLib9TrueAudio10Properties10sampleRateEv:
            __ZNK6TagLib9TrueAudio10Properties10sampleRateEv,
          _ZNK6TagLib9TrueAudio10Properties15lengthInSecondsEv:
            __ZNK6TagLib9TrueAudio10Properties15lengthInSecondsEv,
          _ZNK6TagLib9TrueAudio10Properties20lengthInMillisecondsEv:
            __ZNK6TagLib9TrueAudio10Properties20lengthInMillisecondsEv,
          _ZNK6TagLib9TrueAudio10Properties7bitrateEv:
            __ZNK6TagLib9TrueAudio10Properties7bitrateEv,
          _ZNK6TagLib9TrueAudio10Properties8channelsEv:
            __ZNK6TagLib9TrueAudio10Properties8channelsEv,
          _ZNK6TagLib9TrueAudio4File10propertiesEv:
            __ZNK6TagLib9TrueAudio4File10propertiesEv,
          _ZNK6TagLib9TrueAudio4File15audioPropertiesEv:
            __ZNK6TagLib9TrueAudio4File15audioPropertiesEv,
          _ZNK6TagLib9TrueAudio4File3tagEv: __ZNK6TagLib9TrueAudio4File3tagEv,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm0ELm0EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm0ELm0EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm10ELm10EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm10ELm10EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm11ELm11EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm11ELm11EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm12ELm12EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm12ELm12EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm1ELm1EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm1ELm1EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm2ELm2EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm2ELm2EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm3ELm3EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm3ELm3EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm4ELm4EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm4ELm4EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm5ELm5EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm5ELm5EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm6ELm6EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm6ELm6EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm7ELm7EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm7ELm7EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm8ELm8EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm8ELm8EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm9ELm9EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_:
            __ZNSt3__216__variant_detail12__visitation6__base12__dispatcherIJLm9ELm9EEE10__dispatchB8ue170004IONS1_9__variant15__value_visitorINS_17__convert_to_boolINS_8equal_toIvEEEEEEJRKNS0_6__baseILNS0_6_TraitE1EJNS_9monostateEbijxydN6TagLib6StringENSH_10StringListENSH_10ByteVectorENSH_14ByteVectorListENSH_4ListINSH_7VariantEEENSH_3MapISI_SN_EEEEEST_EEEDcT_DpT0_,
          _ZNSt3__219piecewise_constructE: __ZNSt3__219piecewise_constructE,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEED2Ev,
          _ZNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEED0Ev:
            __ZNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEED0Ev,
          _ZNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEED2Ev:
            __ZNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEED2Ev,
          _ZNSt3__23mapIN6TagLib10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeENS_4lessIS2_EENS_9allocatorINS_4pairIKS2_S5_EEEEE6insertB8ue170004IPKSB_EEvT_SH_:
            __ZNSt3__23mapIN6TagLib10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeENS_4lessIS2_EENS_9allocatorINS_4pairIKS2_S5_EEEEE6insertB8ue170004IPKSB_EEvT_SH_,
          _ZNSt3__23mapIN6TagLib6StringEiNS_4lessIS2_EENS_9allocatorINS_4pairIKS2_iEEEEE6insertB8ue170004INS_20__map_const_iteratorINS_21__tree_const_iteratorINS_12__value_typeIS2_iEEPNS_11__tree_nodeISF_PvEElEEEEEEvT_SM_:
            __ZNSt3__23mapIN6TagLib6StringEiNS_4lessIS2_EENS_9allocatorINS_4pairIKS2_iEEEEE6insertB8ue170004INS_20__map_const_iteratorINS_21__tree_const_iteratorINS_12__value_typeIS2_iEEPNS_11__tree_nodeISF_PvEElEEEEEEvT_SM_,
          _ZNSt3__23mapIjN6TagLib10ByteVectorENS_4lessIjEENS_9allocatorINS_4pairIKjS2_EEEEE6insertB8ue170004INS_20__map_const_iteratorINS_21__tree_const_iteratorINS_12__value_typeIjS2_EEPNS_11__tree_nodeISF_PvEElEEEEEEvT_SM_:
            __ZNSt3__23mapIjN6TagLib10ByteVectorENS_4lessIjEENS_9allocatorINS_4pairIKjS2_EEEEE6insertB8ue170004INS_20__map_const_iteratorINS_21__tree_const_iteratorINS_12__value_typeIjS2_EEPNS_11__tree_nodeISF_PvEElEEEEEEvT_SM_,
          _ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE14__erase_uniqueIS3_EEmRKT_:
            __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE14__erase_uniqueIS3_EEmRKT_,
          _ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRS4_EEENSJ_IJEEEEEENS_4pairINS_15__tree_iteratorIS7_PNS_11__tree_nodeIS7_PvEElEEbEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRS4_EEENSJ_IJEEEEEENS_4pairINS_15__tree_iteratorIS7_PNS_11__tree_nodeIS7_PvEElEEbEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIS4_S6_EEEEENSG_INS_15__tree_iteratorIS7_PNS_11__tree_nodeIS7_PvEElEEbEENS_21__tree_const_iteratorIS7_SO_lEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIKN6TagLib6StringENS2_3APE4ItemEEENS_19__map_value_compareIS4_S7_NS_4lessIS4_EELb1EEENS_9allocatorIS7_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIS4_S6_EEEEENSG_INS_15__tree_iteratorIS7_PNS_11__tree_nodeIS7_PvEElEEbEENS_21__tree_const_iteratorIS7_SO_lEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_3MP411ItemFactory15ItemHandlerTypeEEENS_19__map_value_compareIS3_S7_NS_4lessIS3_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_3MP411ItemFactory15ItemHandlerTypeEEENS_19__map_value_compareIS3_S7_NS_4lessIS3_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS9_PNS_11__tree_nodeIS9_SJ_EElEERPNS_15__tree_end_nodeISL_EESM_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS9_PNS_11__tree_nodeIS9_SJ_EElEERPNS_15__tree_end_nodeISL_EESM_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSL_IJEEEEEENS_4pairINS_15__tree_iteratorIS9_PNS_11__tree_nodeIS9_PvEElEEbEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSL_IJEEEEEENS_4pairINS_15__tree_iteratorIS9_PNS_11__tree_nodeIS9_PvEElEEbEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S8_EEEEENSI_INS_15__tree_iteratorIS9_PNS_11__tree_nodeIS9_PvEElEEbEENS_21__tree_const_iteratorIS9_SR_lEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_4ListIPNS2_5ID3v25FrameEEEEENS_19__map_value_compareIS3_S9_NS_4lessIS3_EELb1EEENS_9allocatorIS9_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S8_EEEEENSI_INS_15__tree_iteratorIS9_PNS_11__tree_nodeIS9_PvEElEEbEENS_21__tree_const_iteratorIS9_SR_lEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE14__erase_uniqueIS3_EEmRKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE14__erase_uniqueIS3_EEmRKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib10ByteVectorENS2_6StringEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataEENS_19__map_value_compareIS5_S7_NS_4lessIS5_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS5_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataEENS_19__map_value_compareIS5_S7_NS_4lessIS5_EELb1EEENS_9allocatorIS7_EEE12__find_equalIS5_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS7_PNS_11__tree_nodeIS7_SH_EElEERPNS_15__tree_end_nodeISJ_EESK_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10ByteVectorEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE14__erase_uniqueIS3_EEmRKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE14__erase_uniqueIS3_EEmRKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_10StringListEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS6_PNS_11__tree_nodeIS6_SG_EElEERPNS_15__tree_end_nodeISI_EESJ_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS6_PNS_11__tree_nodeIS6_SG_EElEERPNS_15__tree_end_nodeISI_EESJ_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE14__erase_uniqueIS3_EEmRKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE14__erase_uniqueIS3_EEmRKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSI_IJEEEEEENS_4pairINS_15__tree_iteratorIS6_PNS_11__tree_nodeIS6_PvEElEEbEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSI_IJEEEEEENS_4pairINS_15__tree_iteratorIS6_PNS_11__tree_nodeIS6_PvEElEEbEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S5_EEEEENSF_INS_15__tree_iteratorIS6_PNS_11__tree_nodeIS6_PvEElEEbEENS_21__tree_const_iteratorIS6_SO_lEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_3MP44ItemEEENS_19__map_value_compareIS3_S6_NS_4lessIS3_EELb1EEENS_9allocatorIS6_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S5_EEEEENSF_INS_15__tree_iteratorIS6_PNS_11__tree_nodeIS6_PvEElEEbEENS_21__tree_const_iteratorIS6_SO_lEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS8_PNS_11__tree_nodeIS8_SI_EElEERPNS_15__tree_end_nodeISK_EESL_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS8_PNS_11__tree_nodeIS8_SI_EElEERPNS_15__tree_end_nodeISK_EESL_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE14__erase_uniqueIS3_EEmRKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE14__erase_uniqueIS3_EEmRKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSK_IJEEEEEENS_4pairINS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEElEEbEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSK_IJEEEEEENS_4pairINS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEElEEbEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S7_EEEEENSH_INS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEElEEbEENS_21__tree_const_iteratorIS8_SQ_lEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_4ListINS2_3ASF9AttributeEEEEENS_19__map_value_compareIS3_S8_NS_4lessIS3_EELb1EEENS_9allocatorIS8_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S7_EEEEENSH_INS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEElEEbEENS_21__tree_const_iteratorIS8_SQ_lEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS5_PNS_11__tree_nodeIS5_SF_EElEERPNS_15__tree_end_nodeISH_EESI_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSH_IJEEEEEENS_4pairINS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringENS2_7VariantEEENS_19__map_value_compareIS3_S5_NS_4lessIS3_EELb1EEENS_9allocatorIS5_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S4_EEEEENSE_INS_15__tree_iteratorIS5_PNS_11__tree_nodeIS5_PvEElEEbEENS_21__tree_const_iteratorIS5_SN_lEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSG_IJEEEEEENS_4pairINS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSG_IJEEEEEENS_4pairINS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S3_EEEEENSD_INS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEENS_21__tree_const_iteratorIS4_SM_lEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringES3_EENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE30__emplace_hint_unique_key_argsIS3_JRKNS_4pairIKS3_S3_EEEEENSD_INS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEENS_21__tree_const_iteratorIS4_SM_lEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringEiEENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringEiEENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE12__find_equalIS3_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_,
          _ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringEiEENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSG_IJEEEEEENS_4pairINS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEERKT_DpOT0_:
            __ZNSt3__26__treeINS_12__value_typeIN6TagLib6StringEiEENS_19__map_value_compareIS3_S4_NS_4lessIS3_EELb1EEENS_9allocatorIS4_EEE25__emplace_unique_key_argsIS3_JRKNS_21piecewise_construct_tENS_5tupleIJRKS3_EEENSG_IJEEEEEENS_4pairINS_15__tree_iteratorIS4_PNS_11__tree_nodeIS4_PvEElEEbEERKT_DpOT0_,
          _ZNSt3__26__treeINS_12__value_typeIjN6TagLib10ByteVectorEEENS_19__map_value_compareIjS4_NS_4lessIjEELb1EEENS_9allocatorIS4_EEE12__find_equalIjEERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_:
            __ZNSt3__26__treeINS_12__value_typeIjN6TagLib10ByteVectorEEENS_19__map_value_compareIjS4_NS_4lessIjEELb1EEENS_9allocatorIS4_EEE12__find_equalIjEERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorIS4_PNS_11__tree_nodeIS4_SE_EElEERPNS_15__tree_end_nodeISG_EESH_RKT_,
          _ZNSt3__26vectorI5ChunkNS_9allocatorIS1_EEE21__push_back_slow_pathIS1_EEvOT_:
            __ZNSt3__26vectorI5ChunkNS_9allocatorIS1_EEE21__push_back_slow_pathIS1_EEvOT_,
          _ZTIN4utf812invalid_utf8E: __ZTIN4utf812invalid_utf8E,
          _ZTIN4utf813invalid_utf16E: __ZTIN4utf813invalid_utf16E,
          _ZTIN4utf815not_enough_roomE: __ZTIN4utf815not_enough_roomE,
          _ZTIN4utf818invalid_code_pointE: __ZTIN4utf818invalid_code_pointE,
          _ZTIN4utf89exceptionE: __ZTIN4utf89exceptionE,
          _ZTIN6TagLib10FileStreamE: __ZTIN6TagLib10FileStreamE,
          _ZTIN6TagLib13DebugListenerE: __ZTIN6TagLib13DebugListenerE,
          _ZTIN6TagLib15AudioPropertiesE: __ZTIN6TagLib15AudioPropertiesE,
          _ZTIN6TagLib16ByteVectorStreamE: __ZTIN6TagLib16ByteVectorStreamE,
          _ZTIN6TagLib2IT10PropertiesE: __ZTIN6TagLib2IT10PropertiesE,
          _ZTIN6TagLib2IT4FileE: __ZTIN6TagLib2IT4FileE,
          _ZTIN6TagLib2XM10PropertiesE: __ZTIN6TagLib2XM10PropertiesE,
          _ZTIN6TagLib2XM4FileE: __ZTIN6TagLib2XM4FileE,
          _ZTIN6TagLib3APE10PropertiesE: __ZTIN6TagLib3APE10PropertiesE,
          _ZTIN6TagLib3APE3TagE: __ZTIN6TagLib3APE3TagE,
          _ZTIN6TagLib3APE4FileE: __ZTIN6TagLib3APE4FileE,
          _ZTIN6TagLib3APE4ItemE: __ZTIN6TagLib3APE4ItemE,
          _ZTIN6TagLib3APE6FooterE: __ZTIN6TagLib3APE6FooterE,
          _ZTIN6TagLib3ASF10PropertiesE: __ZTIN6TagLib3ASF10PropertiesE,
          _ZTIN6TagLib3ASF3TagE: __ZTIN6TagLib3ASF3TagE,
          _ZTIN6TagLib3ASF4File11FilePrivate10BaseObjectE:
            __ZTIN6TagLib3ASF4File11FilePrivate10BaseObjectE,
          _ZTIN6TagLib3ASF4File11FilePrivate13UnknownObjectE:
            __ZTIN6TagLib3ASF4File11FilePrivate13UnknownObjectE,
          _ZTIN6TagLib3ASF4File11FilePrivate14MetadataObjectE:
            __ZTIN6TagLib3ASF4File11FilePrivate14MetadataObjectE,
          _ZTIN6TagLib3ASF4File11FilePrivate15CodecListObjectE:
            __ZTIN6TagLib3ASF4File11FilePrivate15CodecListObjectE,
          _ZTIN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE:
            __ZTIN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE,
          _ZTIN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE:
            __ZTIN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE,
          _ZTIN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE:
            __ZTIN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE,
          _ZTIN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE:
            __ZTIN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE,
          _ZTIN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE:
            __ZTIN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE,
          _ZTIN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE:
            __ZTIN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE,
          _ZTIN6TagLib3ASF4FileE: __ZTIN6TagLib3ASF4FileE,
          _ZTIN6TagLib3ASF7PictureE: __ZTIN6TagLib3ASF7PictureE,
          _ZTIN6TagLib3ASF9AttributeE: __ZTIN6TagLib3ASF9AttributeE,
          _ZTIN6TagLib3DSF10PropertiesE: __ZTIN6TagLib3DSF10PropertiesE,
          _ZTIN6TagLib3DSF4FileE: __ZTIN6TagLib3DSF4FileE,
          _ZTIN6TagLib3MP410PropertiesE: __ZTIN6TagLib3MP410PropertiesE,
          _ZTIN6TagLib3MP411ItemFactoryE: __ZTIN6TagLib3MP411ItemFactoryE,
          _ZTIN6TagLib3MP43TagE: __ZTIN6TagLib3MP43TagE,
          _ZTIN6TagLib3MP44FileE: __ZTIN6TagLib3MP44FileE,
          _ZTIN6TagLib3MP44ItemE: __ZTIN6TagLib3MP44ItemE,
          _ZTIN6TagLib3MP48CoverArtE: __ZTIN6TagLib3MP48CoverArtE,
          _ZTIN6TagLib3MPC10PropertiesE: __ZTIN6TagLib3MPC10PropertiesE,
          _ZTIN6TagLib3MPC4FileE: __ZTIN6TagLib3MPC4FileE,
          _ZTIN6TagLib3Mod10PropertiesE: __ZTIN6TagLib3Mod10PropertiesE,
          _ZTIN6TagLib3Mod3TagE: __ZTIN6TagLib3Mod3TagE,
          _ZTIN6TagLib3Mod4FileE: __ZTIN6TagLib3Mod4FileE,
          _ZTIN6TagLib3Mod8FileBaseE: __ZTIN6TagLib3Mod8FileBaseE,
          _ZTIN6TagLib3Ogg10PageHeaderE: __ZTIN6TagLib3Ogg10PageHeaderE,
          _ZTIN6TagLib3Ogg11XiphCommentE: __ZTIN6TagLib3Ogg11XiphCommentE,
          _ZTIN6TagLib3Ogg4FLAC4FileE: __ZTIN6TagLib3Ogg4FLAC4FileE,
          _ZTIN6TagLib3Ogg4FileE: __ZTIN6TagLib3Ogg4FileE,
          _ZTIN6TagLib3Ogg4Opus10PropertiesE:
            __ZTIN6TagLib3Ogg4Opus10PropertiesE,
          _ZTIN6TagLib3Ogg4Opus4FileE: __ZTIN6TagLib3Ogg4Opus4FileE,
          _ZTIN6TagLib3Ogg4PageE: __ZTIN6TagLib3Ogg4PageE,
          _ZTIN6TagLib3Ogg5Speex10PropertiesE:
            __ZTIN6TagLib3Ogg5Speex10PropertiesE,
          _ZTIN6TagLib3Ogg5Speex4FileE: __ZTIN6TagLib3Ogg5Speex4FileE,
          _ZTIN6TagLib3S3M10PropertiesE: __ZTIN6TagLib3S3M10PropertiesE,
          _ZTIN6TagLib3S3M4FileE: __ZTIN6TagLib3S3M4FileE,
          _ZTIN6TagLib3TagE: __ZTIN6TagLib3TagE,
          _ZTIN6TagLib4FLAC10PropertiesE: __ZTIN6TagLib4FLAC10PropertiesE,
          _ZTIN6TagLib4FLAC13MetadataBlockE: __ZTIN6TagLib4FLAC13MetadataBlockE,
          _ZTIN6TagLib4FLAC20UnknownMetadataBlockE:
            __ZTIN6TagLib4FLAC20UnknownMetadataBlockE,
          _ZTIN6TagLib4FLAC4FileE: __ZTIN6TagLib4FLAC4FileE,
          _ZTIN6TagLib4FLAC7PictureE: __ZTIN6TagLib4FLAC7PictureE,
          _ZTIN6TagLib4FileE: __ZTIN6TagLib4FileE,
          _ZTIN6TagLib4MPEG10PropertiesE: __ZTIN6TagLib4MPEG10PropertiesE,
          _ZTIN6TagLib4MPEG10XingHeaderE: __ZTIN6TagLib4MPEG10XingHeaderE,
          _ZTIN6TagLib4MPEG4FileE: __ZTIN6TagLib4MPEG4FileE,
          _ZTIN6TagLib4MPEG6HeaderE: __ZTIN6TagLib4MPEG6HeaderE,
          _ZTIN6TagLib4RIFF3WAV10PropertiesE:
            __ZTIN6TagLib4RIFF3WAV10PropertiesE,
          _ZTIN6TagLib4RIFF3WAV4FileE: __ZTIN6TagLib4RIFF3WAV4FileE,
          _ZTIN6TagLib4RIFF4AIFF10PropertiesE:
            __ZTIN6TagLib4RIFF4AIFF10PropertiesE,
          _ZTIN6TagLib4RIFF4AIFF4FileE: __ZTIN6TagLib4RIFF4AIFF4FileE,
          _ZTIN6TagLib4RIFF4FileE: __ZTIN6TagLib4RIFF4FileE,
          _ZTIN6TagLib4RIFF4Info13StringHandlerE:
            __ZTIN6TagLib4RIFF4Info13StringHandlerE,
          _ZTIN6TagLib4RIFF4Info3TagE: __ZTIN6TagLib4RIFF4Info3TagE,
          _ZTIN6TagLib5ID3v113StringHandlerE:
            __ZTIN6TagLib5ID3v113StringHandlerE,
          _ZTIN6TagLib5ID3v13TagE: __ZTIN6TagLib5ID3v13TagE,
          _ZTIN6TagLib5ID3v212ChapterFrameE: __ZTIN6TagLib5ID3v212ChapterFrameE,
          _ZTIN6TagLib5ID3v212FrameFactoryE: __ZTIN6TagLib5ID3v212FrameFactoryE,
          _ZTIN6TagLib5ID3v212PodcastFrameE: __ZTIN6TagLib5ID3v212PodcastFrameE,
          _ZTIN6TagLib5ID3v212PrivateFrameE: __ZTIN6TagLib5ID3v212PrivateFrameE,
          _ZTIN6TagLib5ID3v212UnknownFrameE: __ZTIN6TagLib5ID3v212UnknownFrameE,
          _ZTIN6TagLib5ID3v212UrlLinkFrameE: __ZTIN6TagLib5ID3v212UrlLinkFrameE,
          _ZTIN6TagLib5ID3v213CommentsFrameE:
            __ZTIN6TagLib5ID3v213CommentsFrameE,
          _ZTIN6TagLib5ID3v214ExtendedHeaderE:
            __ZTIN6TagLib5ID3v214ExtendedHeaderE,
          _ZTIN6TagLib5ID3v214OwnershipFrameE:
            __ZTIN6TagLib5ID3v214OwnershipFrameE,
          _ZTIN6TagLib5ID3v216UserUrlLinkFrameE:
            __ZTIN6TagLib5ID3v216UserUrlLinkFrameE,
          _ZTIN6TagLib5ID3v218PopularimeterFrameE:
            __ZTIN6TagLib5ID3v218PopularimeterFrameE,
          _ZTIN6TagLib5ID3v219Latin1StringHandlerE:
            __ZTIN6TagLib5ID3v219Latin1StringHandlerE,
          _ZTIN6TagLib5ID3v219RelativeVolumeFrameE:
            __ZTIN6TagLib5ID3v219RelativeVolumeFrameE,
          _ZTIN6TagLib5ID3v220AttachedPictureFrameE:
            __ZTIN6TagLib5ID3v220AttachedPictureFrameE,
          _ZTIN6TagLib5ID3v220TableOfContentsFrameE:
            __ZTIN6TagLib5ID3v220TableOfContentsFrameE,
          _ZTIN6TagLib5ID3v221EventTimingCodesFrameE:
            __ZTIN6TagLib5ID3v221EventTimingCodesFrameE,
          _ZTIN6TagLib5ID3v223AttachedPictureFrameV22E:
            __ZTIN6TagLib5ID3v223AttachedPictureFrameV22E,
          _ZTIN6TagLib5ID3v223SynchronizedLyricsFrameE:
            __ZTIN6TagLib5ID3v223SynchronizedLyricsFrameE,
          _ZTIN6TagLib5ID3v223TextIdentificationFrameE:
            __ZTIN6TagLib5ID3v223TextIdentificationFrameE,
          _ZTIN6TagLib5ID3v225UniqueFileIdentifierFrameE:
            __ZTIN6TagLib5ID3v225UniqueFileIdentifierFrameE,
          _ZTIN6TagLib5ID3v225UnsynchronizedLyricsFrameE:
            __ZTIN6TagLib5ID3v225UnsynchronizedLyricsFrameE,
          _ZTIN6TagLib5ID3v227UserTextIdentificationFrameE:
            __ZTIN6TagLib5ID3v227UserTextIdentificationFrameE,
          _ZTIN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE:
            __ZTIN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE,
          _ZTIN6TagLib5ID3v23TagE: __ZTIN6TagLib5ID3v23TagE,
          _ZTIN6TagLib5ID3v25Frame6HeaderE: __ZTIN6TagLib5ID3v25Frame6HeaderE,
          _ZTIN6TagLib5ID3v25FrameE: __ZTIN6TagLib5ID3v25FrameE,
          _ZTIN6TagLib5ID3v26FooterE: __ZTIN6TagLib5ID3v26FooterE,
          _ZTIN6TagLib5ID3v26HeaderE: __ZTIN6TagLib5ID3v26HeaderE,
          _ZTIN6TagLib6DSDIFF10PropertiesE: __ZTIN6TagLib6DSDIFF10PropertiesE,
          _ZTIN6TagLib6DSDIFF4DIIN3TagE: __ZTIN6TagLib6DSDIFF4DIIN3TagE,
          _ZTIN6TagLib6DSDIFF4FileE: __ZTIN6TagLib6DSDIFF4FileE,
          _ZTIN6TagLib6Vorbis10PropertiesE: __ZTIN6TagLib6Vorbis10PropertiesE,
          _ZTIN6TagLib6Vorbis4FileE: __ZTIN6TagLib6Vorbis4FileE,
          _ZTIN6TagLib7FileRef16FileTypeResolverE:
            __ZTIN6TagLib7FileRef16FileTypeResolverE,
          _ZTIN6TagLib7FileRef18StreamTypeResolverE:
            __ZTIN6TagLib7FileRef18StreamTypeResolverE,
          _ZTIN6TagLib7WavPack10PropertiesE: __ZTIN6TagLib7WavPack10PropertiesE,
          _ZTIN6TagLib7WavPack4FileE: __ZTIN6TagLib7WavPack4FileE,
          _ZTIN6TagLib8IOStreamE: __ZTIN6TagLib8IOStreamE,
          _ZTIN6TagLib8TagUnionE: __ZTIN6TagLib8TagUnionE,
          _ZTIN6TagLib9TrueAudio10PropertiesE:
            __ZTIN6TagLib9TrueAudio10PropertiesE,
          _ZTIN6TagLib9TrueAudio4FileE: __ZTIN6TagLib9TrueAudio4FileE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE,
          _ZTINSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE:
            __ZTINSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE,
          _ZTSN4utf812invalid_utf8E: __ZTSN4utf812invalid_utf8E,
          _ZTSN4utf813invalid_utf16E: __ZTSN4utf813invalid_utf16E,
          _ZTSN4utf815not_enough_roomE: __ZTSN4utf815not_enough_roomE,
          _ZTSN4utf818invalid_code_pointE: __ZTSN4utf818invalid_code_pointE,
          _ZTSN4utf89exceptionE: __ZTSN4utf89exceptionE,
          _ZTSN6TagLib10FileStreamE: __ZTSN6TagLib10FileStreamE,
          _ZTSN6TagLib13DebugListenerE: __ZTSN6TagLib13DebugListenerE,
          _ZTSN6TagLib15AudioPropertiesE: __ZTSN6TagLib15AudioPropertiesE,
          _ZTSN6TagLib16ByteVectorStreamE: __ZTSN6TagLib16ByteVectorStreamE,
          _ZTSN6TagLib2IT10PropertiesE: __ZTSN6TagLib2IT10PropertiesE,
          _ZTSN6TagLib2IT4FileE: __ZTSN6TagLib2IT4FileE,
          _ZTSN6TagLib2XM10PropertiesE: __ZTSN6TagLib2XM10PropertiesE,
          _ZTSN6TagLib2XM4FileE: __ZTSN6TagLib2XM4FileE,
          _ZTSN6TagLib3APE10PropertiesE: __ZTSN6TagLib3APE10PropertiesE,
          _ZTSN6TagLib3APE3TagE: __ZTSN6TagLib3APE3TagE,
          _ZTSN6TagLib3APE4FileE: __ZTSN6TagLib3APE4FileE,
          _ZTSN6TagLib3APE4ItemE: __ZTSN6TagLib3APE4ItemE,
          _ZTSN6TagLib3APE6FooterE: __ZTSN6TagLib3APE6FooterE,
          _ZTSN6TagLib3ASF10PropertiesE: __ZTSN6TagLib3ASF10PropertiesE,
          _ZTSN6TagLib3ASF3TagE: __ZTSN6TagLib3ASF3TagE,
          _ZTSN6TagLib3ASF4File11FilePrivate10BaseObjectE:
            __ZTSN6TagLib3ASF4File11FilePrivate10BaseObjectE,
          _ZTSN6TagLib3ASF4File11FilePrivate13UnknownObjectE:
            __ZTSN6TagLib3ASF4File11FilePrivate13UnknownObjectE,
          _ZTSN6TagLib3ASF4File11FilePrivate14MetadataObjectE:
            __ZTSN6TagLib3ASF4File11FilePrivate14MetadataObjectE,
          _ZTSN6TagLib3ASF4File11FilePrivate15CodecListObjectE:
            __ZTSN6TagLib3ASF4File11FilePrivate15CodecListObjectE,
          _ZTSN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE:
            __ZTSN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE,
          _ZTSN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE:
            __ZTSN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE,
          _ZTSN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE:
            __ZTSN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE,
          _ZTSN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE:
            __ZTSN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE,
          _ZTSN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE:
            __ZTSN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE,
          _ZTSN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE:
            __ZTSN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE,
          _ZTSN6TagLib3ASF4FileE: __ZTSN6TagLib3ASF4FileE,
          _ZTSN6TagLib3ASF7PictureE: __ZTSN6TagLib3ASF7PictureE,
          _ZTSN6TagLib3ASF9AttributeE: __ZTSN6TagLib3ASF9AttributeE,
          _ZTSN6TagLib3DSF10PropertiesE: __ZTSN6TagLib3DSF10PropertiesE,
          _ZTSN6TagLib3DSF4FileE: __ZTSN6TagLib3DSF4FileE,
          _ZTSN6TagLib3MP410PropertiesE: __ZTSN6TagLib3MP410PropertiesE,
          _ZTSN6TagLib3MP411ItemFactoryE: __ZTSN6TagLib3MP411ItemFactoryE,
          _ZTSN6TagLib3MP43TagE: __ZTSN6TagLib3MP43TagE,
          _ZTSN6TagLib3MP44FileE: __ZTSN6TagLib3MP44FileE,
          _ZTSN6TagLib3MP44ItemE: __ZTSN6TagLib3MP44ItemE,
          _ZTSN6TagLib3MP48CoverArtE: __ZTSN6TagLib3MP48CoverArtE,
          _ZTSN6TagLib3MPC10PropertiesE: __ZTSN6TagLib3MPC10PropertiesE,
          _ZTSN6TagLib3MPC4FileE: __ZTSN6TagLib3MPC4FileE,
          _ZTSN6TagLib3Mod10PropertiesE: __ZTSN6TagLib3Mod10PropertiesE,
          _ZTSN6TagLib3Mod3TagE: __ZTSN6TagLib3Mod3TagE,
          _ZTSN6TagLib3Mod4FileE: __ZTSN6TagLib3Mod4FileE,
          _ZTSN6TagLib3Mod8FileBaseE: __ZTSN6TagLib3Mod8FileBaseE,
          _ZTSN6TagLib3Ogg10PageHeaderE: __ZTSN6TagLib3Ogg10PageHeaderE,
          _ZTSN6TagLib3Ogg11XiphCommentE: __ZTSN6TagLib3Ogg11XiphCommentE,
          _ZTSN6TagLib3Ogg4FLAC4FileE: __ZTSN6TagLib3Ogg4FLAC4FileE,
          _ZTSN6TagLib3Ogg4FileE: __ZTSN6TagLib3Ogg4FileE,
          _ZTSN6TagLib3Ogg4Opus10PropertiesE:
            __ZTSN6TagLib3Ogg4Opus10PropertiesE,
          _ZTSN6TagLib3Ogg4Opus4FileE: __ZTSN6TagLib3Ogg4Opus4FileE,
          _ZTSN6TagLib3Ogg4PageE: __ZTSN6TagLib3Ogg4PageE,
          _ZTSN6TagLib3Ogg5Speex10PropertiesE:
            __ZTSN6TagLib3Ogg5Speex10PropertiesE,
          _ZTSN6TagLib3Ogg5Speex4FileE: __ZTSN6TagLib3Ogg5Speex4FileE,
          _ZTSN6TagLib3S3M10PropertiesE: __ZTSN6TagLib3S3M10PropertiesE,
          _ZTSN6TagLib3S3M4FileE: __ZTSN6TagLib3S3M4FileE,
          _ZTSN6TagLib3TagE: __ZTSN6TagLib3TagE,
          _ZTSN6TagLib4FLAC10PropertiesE: __ZTSN6TagLib4FLAC10PropertiesE,
          _ZTSN6TagLib4FLAC13MetadataBlockE: __ZTSN6TagLib4FLAC13MetadataBlockE,
          _ZTSN6TagLib4FLAC20UnknownMetadataBlockE:
            __ZTSN6TagLib4FLAC20UnknownMetadataBlockE,
          _ZTSN6TagLib4FLAC4FileE: __ZTSN6TagLib4FLAC4FileE,
          _ZTSN6TagLib4FLAC7PictureE: __ZTSN6TagLib4FLAC7PictureE,
          _ZTSN6TagLib4FileE: __ZTSN6TagLib4FileE,
          _ZTSN6TagLib4MPEG10PropertiesE: __ZTSN6TagLib4MPEG10PropertiesE,
          _ZTSN6TagLib4MPEG10XingHeaderE: __ZTSN6TagLib4MPEG10XingHeaderE,
          _ZTSN6TagLib4MPEG4FileE: __ZTSN6TagLib4MPEG4FileE,
          _ZTSN6TagLib4MPEG6HeaderE: __ZTSN6TagLib4MPEG6HeaderE,
          _ZTSN6TagLib4RIFF3WAV10PropertiesE:
            __ZTSN6TagLib4RIFF3WAV10PropertiesE,
          _ZTSN6TagLib4RIFF3WAV4FileE: __ZTSN6TagLib4RIFF3WAV4FileE,
          _ZTSN6TagLib4RIFF4AIFF10PropertiesE:
            __ZTSN6TagLib4RIFF4AIFF10PropertiesE,
          _ZTSN6TagLib4RIFF4AIFF4FileE: __ZTSN6TagLib4RIFF4AIFF4FileE,
          _ZTSN6TagLib4RIFF4FileE: __ZTSN6TagLib4RIFF4FileE,
          _ZTSN6TagLib4RIFF4Info13StringHandlerE:
            __ZTSN6TagLib4RIFF4Info13StringHandlerE,
          _ZTSN6TagLib4RIFF4Info3TagE: __ZTSN6TagLib4RIFF4Info3TagE,
          _ZTSN6TagLib5ID3v113StringHandlerE:
            __ZTSN6TagLib5ID3v113StringHandlerE,
          _ZTSN6TagLib5ID3v13TagE: __ZTSN6TagLib5ID3v13TagE,
          _ZTSN6TagLib5ID3v212ChapterFrameE: __ZTSN6TagLib5ID3v212ChapterFrameE,
          _ZTSN6TagLib5ID3v212FrameFactoryE: __ZTSN6TagLib5ID3v212FrameFactoryE,
          _ZTSN6TagLib5ID3v212PodcastFrameE: __ZTSN6TagLib5ID3v212PodcastFrameE,
          _ZTSN6TagLib5ID3v212PrivateFrameE: __ZTSN6TagLib5ID3v212PrivateFrameE,
          _ZTSN6TagLib5ID3v212UnknownFrameE: __ZTSN6TagLib5ID3v212UnknownFrameE,
          _ZTSN6TagLib5ID3v212UrlLinkFrameE: __ZTSN6TagLib5ID3v212UrlLinkFrameE,
          _ZTSN6TagLib5ID3v213CommentsFrameE:
            __ZTSN6TagLib5ID3v213CommentsFrameE,
          _ZTSN6TagLib5ID3v214ExtendedHeaderE:
            __ZTSN6TagLib5ID3v214ExtendedHeaderE,
          _ZTSN6TagLib5ID3v214OwnershipFrameE:
            __ZTSN6TagLib5ID3v214OwnershipFrameE,
          _ZTSN6TagLib5ID3v216UserUrlLinkFrameE:
            __ZTSN6TagLib5ID3v216UserUrlLinkFrameE,
          _ZTSN6TagLib5ID3v218PopularimeterFrameE:
            __ZTSN6TagLib5ID3v218PopularimeterFrameE,
          _ZTSN6TagLib5ID3v219Latin1StringHandlerE:
            __ZTSN6TagLib5ID3v219Latin1StringHandlerE,
          _ZTSN6TagLib5ID3v219RelativeVolumeFrameE:
            __ZTSN6TagLib5ID3v219RelativeVolumeFrameE,
          _ZTSN6TagLib5ID3v220AttachedPictureFrameE:
            __ZTSN6TagLib5ID3v220AttachedPictureFrameE,
          _ZTSN6TagLib5ID3v220TableOfContentsFrameE:
            __ZTSN6TagLib5ID3v220TableOfContentsFrameE,
          _ZTSN6TagLib5ID3v221EventTimingCodesFrameE:
            __ZTSN6TagLib5ID3v221EventTimingCodesFrameE,
          _ZTSN6TagLib5ID3v223AttachedPictureFrameV22E:
            __ZTSN6TagLib5ID3v223AttachedPictureFrameV22E,
          _ZTSN6TagLib5ID3v223SynchronizedLyricsFrameE:
            __ZTSN6TagLib5ID3v223SynchronizedLyricsFrameE,
          _ZTSN6TagLib5ID3v223TextIdentificationFrameE:
            __ZTSN6TagLib5ID3v223TextIdentificationFrameE,
          _ZTSN6TagLib5ID3v225UniqueFileIdentifierFrameE:
            __ZTSN6TagLib5ID3v225UniqueFileIdentifierFrameE,
          _ZTSN6TagLib5ID3v225UnsynchronizedLyricsFrameE:
            __ZTSN6TagLib5ID3v225UnsynchronizedLyricsFrameE,
          _ZTSN6TagLib5ID3v227UserTextIdentificationFrameE:
            __ZTSN6TagLib5ID3v227UserTextIdentificationFrameE,
          _ZTSN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE:
            __ZTSN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE,
          _ZTSN6TagLib5ID3v23TagE: __ZTSN6TagLib5ID3v23TagE,
          _ZTSN6TagLib5ID3v25Frame6HeaderE: __ZTSN6TagLib5ID3v25Frame6HeaderE,
          _ZTSN6TagLib5ID3v25FrameE: __ZTSN6TagLib5ID3v25FrameE,
          _ZTSN6TagLib5ID3v26FooterE: __ZTSN6TagLib5ID3v26FooterE,
          _ZTSN6TagLib5ID3v26HeaderE: __ZTSN6TagLib5ID3v26HeaderE,
          _ZTSN6TagLib6DSDIFF10PropertiesE: __ZTSN6TagLib6DSDIFF10PropertiesE,
          _ZTSN6TagLib6DSDIFF4DIIN3TagE: __ZTSN6TagLib6DSDIFF4DIIN3TagE,
          _ZTSN6TagLib6DSDIFF4FileE: __ZTSN6TagLib6DSDIFF4FileE,
          _ZTSN6TagLib6Vorbis10PropertiesE: __ZTSN6TagLib6Vorbis10PropertiesE,
          _ZTSN6TagLib6Vorbis4FileE: __ZTSN6TagLib6Vorbis4FileE,
          _ZTSN6TagLib7FileRef16FileTypeResolverE:
            __ZTSN6TagLib7FileRef16FileTypeResolverE,
          _ZTSN6TagLib7FileRef18StreamTypeResolverE:
            __ZTSN6TagLib7FileRef18StreamTypeResolverE,
          _ZTSN6TagLib7WavPack10PropertiesE: __ZTSN6TagLib7WavPack10PropertiesE,
          _ZTSN6TagLib7WavPack4FileE: __ZTSN6TagLib7WavPack4FileE,
          _ZTSN6TagLib8IOStreamE: __ZTSN6TagLib8IOStreamE,
          _ZTSN6TagLib8TagUnionE: __ZTSN6TagLib8TagUnionE,
          _ZTSN6TagLib9TrueAudio10PropertiesE:
            __ZTSN6TagLib9TrueAudio10PropertiesE,
          _ZTSN6TagLib9TrueAudio4FileE: __ZTSN6TagLib9TrueAudio4FileE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE,
          _ZTSNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE:
            __ZTSNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE,
          _ZTVN4utf812invalid_utf8E: __ZTVN4utf812invalid_utf8E,
          _ZTVN4utf813invalid_utf16E: __ZTVN4utf813invalid_utf16E,
          _ZTVN4utf815not_enough_roomE: __ZTVN4utf815not_enough_roomE,
          _ZTVN4utf818invalid_code_pointE: __ZTVN4utf818invalid_code_pointE,
          _ZTVN6TagLib10FileStreamE: __ZTVN6TagLib10FileStreamE,
          _ZTVN6TagLib13DebugListenerE: __ZTVN6TagLib13DebugListenerE,
          _ZTVN6TagLib15AudioPropertiesE: __ZTVN6TagLib15AudioPropertiesE,
          _ZTVN6TagLib16ByteVectorStreamE: __ZTVN6TagLib16ByteVectorStreamE,
          _ZTVN6TagLib2IT10PropertiesE: __ZTVN6TagLib2IT10PropertiesE,
          _ZTVN6TagLib2IT4FileE: __ZTVN6TagLib2IT4FileE,
          _ZTVN6TagLib2XM10PropertiesE: __ZTVN6TagLib2XM10PropertiesE,
          _ZTVN6TagLib2XM4FileE: __ZTVN6TagLib2XM4FileE,
          _ZTVN6TagLib3APE10PropertiesE: __ZTVN6TagLib3APE10PropertiesE,
          _ZTVN6TagLib3APE3TagE: __ZTVN6TagLib3APE3TagE,
          _ZTVN6TagLib3APE4FileE: __ZTVN6TagLib3APE4FileE,
          _ZTVN6TagLib3APE4ItemE: __ZTVN6TagLib3APE4ItemE,
          _ZTVN6TagLib3APE6FooterE: __ZTVN6TagLib3APE6FooterE,
          _ZTVN6TagLib3ASF10PropertiesE: __ZTVN6TagLib3ASF10PropertiesE,
          _ZTVN6TagLib3ASF3TagE: __ZTVN6TagLib3ASF3TagE,
          _ZTVN6TagLib3ASF4File11FilePrivate10BaseObjectE:
            __ZTVN6TagLib3ASF4File11FilePrivate10BaseObjectE,
          _ZTVN6TagLib3ASF4File11FilePrivate13UnknownObjectE:
            __ZTVN6TagLib3ASF4File11FilePrivate13UnknownObjectE,
          _ZTVN6TagLib3ASF4File11FilePrivate14MetadataObjectE:
            __ZTVN6TagLib3ASF4File11FilePrivate14MetadataObjectE,
          _ZTVN6TagLib3ASF4File11FilePrivate15CodecListObjectE:
            __ZTVN6TagLib3ASF4File11FilePrivate15CodecListObjectE,
          _ZTVN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE:
            __ZTVN6TagLib3ASF4File11FilePrivate20FilePropertiesObjectE,
          _ZTVN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE:
            __ZTVN6TagLib3ASF4File11FilePrivate21HeaderExtensionObjectE,
          _ZTVN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE:
            __ZTVN6TagLib3ASF4File11FilePrivate21MetadataLibraryObjectE,
          _ZTVN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE:
            __ZTVN6TagLib3ASF4File11FilePrivate22StreamPropertiesObjectE,
          _ZTVN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE:
            __ZTVN6TagLib3ASF4File11FilePrivate24ContentDescriptionObjectE,
          _ZTVN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE:
            __ZTVN6TagLib3ASF4File11FilePrivate32ExtendedContentDescriptionObjectE,
          _ZTVN6TagLib3ASF4FileE: __ZTVN6TagLib3ASF4FileE,
          _ZTVN6TagLib3ASF7PictureE: __ZTVN6TagLib3ASF7PictureE,
          _ZTVN6TagLib3ASF9AttributeE: __ZTVN6TagLib3ASF9AttributeE,
          _ZTVN6TagLib3DSF10PropertiesE: __ZTVN6TagLib3DSF10PropertiesE,
          _ZTVN6TagLib3DSF4FileE: __ZTVN6TagLib3DSF4FileE,
          _ZTVN6TagLib3MP410PropertiesE: __ZTVN6TagLib3MP410PropertiesE,
          _ZTVN6TagLib3MP411ItemFactoryE: __ZTVN6TagLib3MP411ItemFactoryE,
          _ZTVN6TagLib3MP43TagE: __ZTVN6TagLib3MP43TagE,
          _ZTVN6TagLib3MP44FileE: __ZTVN6TagLib3MP44FileE,
          _ZTVN6TagLib3MP44ItemE: __ZTVN6TagLib3MP44ItemE,
          _ZTVN6TagLib3MP48CoverArtE: __ZTVN6TagLib3MP48CoverArtE,
          _ZTVN6TagLib3MPC10PropertiesE: __ZTVN6TagLib3MPC10PropertiesE,
          _ZTVN6TagLib3MPC4FileE: __ZTVN6TagLib3MPC4FileE,
          _ZTVN6TagLib3Mod10PropertiesE: __ZTVN6TagLib3Mod10PropertiesE,
          _ZTVN6TagLib3Mod3TagE: __ZTVN6TagLib3Mod3TagE,
          _ZTVN6TagLib3Mod4FileE: __ZTVN6TagLib3Mod4FileE,
          _ZTVN6TagLib3Mod8FileBaseE: __ZTVN6TagLib3Mod8FileBaseE,
          _ZTVN6TagLib3Ogg10PageHeaderE: __ZTVN6TagLib3Ogg10PageHeaderE,
          _ZTVN6TagLib3Ogg11XiphCommentE: __ZTVN6TagLib3Ogg11XiphCommentE,
          _ZTVN6TagLib3Ogg4FLAC4FileE: __ZTVN6TagLib3Ogg4FLAC4FileE,
          _ZTVN6TagLib3Ogg4FileE: __ZTVN6TagLib3Ogg4FileE,
          _ZTVN6TagLib3Ogg4Opus10PropertiesE:
            __ZTVN6TagLib3Ogg4Opus10PropertiesE,
          _ZTVN6TagLib3Ogg4Opus4FileE: __ZTVN6TagLib3Ogg4Opus4FileE,
          _ZTVN6TagLib3Ogg4PageE: __ZTVN6TagLib3Ogg4PageE,
          _ZTVN6TagLib3Ogg5Speex10PropertiesE:
            __ZTVN6TagLib3Ogg5Speex10PropertiesE,
          _ZTVN6TagLib3Ogg5Speex4FileE: __ZTVN6TagLib3Ogg5Speex4FileE,
          _ZTVN6TagLib3S3M10PropertiesE: __ZTVN6TagLib3S3M10PropertiesE,
          _ZTVN6TagLib3S3M4FileE: __ZTVN6TagLib3S3M4FileE,
          _ZTVN6TagLib3TagE: __ZTVN6TagLib3TagE,
          _ZTVN6TagLib4FLAC10PropertiesE: __ZTVN6TagLib4FLAC10PropertiesE,
          _ZTVN6TagLib4FLAC13MetadataBlockE: __ZTVN6TagLib4FLAC13MetadataBlockE,
          _ZTVN6TagLib4FLAC20UnknownMetadataBlockE:
            __ZTVN6TagLib4FLAC20UnknownMetadataBlockE,
          _ZTVN6TagLib4FLAC4FileE: __ZTVN6TagLib4FLAC4FileE,
          _ZTVN6TagLib4FLAC7PictureE: __ZTVN6TagLib4FLAC7PictureE,
          _ZTVN6TagLib4FileE: __ZTVN6TagLib4FileE,
          _ZTVN6TagLib4MPEG10PropertiesE: __ZTVN6TagLib4MPEG10PropertiesE,
          _ZTVN6TagLib4MPEG10XingHeaderE: __ZTVN6TagLib4MPEG10XingHeaderE,
          _ZTVN6TagLib4MPEG4FileE: __ZTVN6TagLib4MPEG4FileE,
          _ZTVN6TagLib4MPEG6HeaderE: __ZTVN6TagLib4MPEG6HeaderE,
          _ZTVN6TagLib4RIFF3WAV10PropertiesE:
            __ZTVN6TagLib4RIFF3WAV10PropertiesE,
          _ZTVN6TagLib4RIFF3WAV4FileE: __ZTVN6TagLib4RIFF3WAV4FileE,
          _ZTVN6TagLib4RIFF4AIFF10PropertiesE:
            __ZTVN6TagLib4RIFF4AIFF10PropertiesE,
          _ZTVN6TagLib4RIFF4AIFF4FileE: __ZTVN6TagLib4RIFF4AIFF4FileE,
          _ZTVN6TagLib4RIFF4FileE: __ZTVN6TagLib4RIFF4FileE,
          _ZTVN6TagLib4RIFF4Info13StringHandlerE:
            __ZTVN6TagLib4RIFF4Info13StringHandlerE,
          _ZTVN6TagLib4RIFF4Info3TagE: __ZTVN6TagLib4RIFF4Info3TagE,
          _ZTVN6TagLib5ID3v113StringHandlerE:
            __ZTVN6TagLib5ID3v113StringHandlerE,
          _ZTVN6TagLib5ID3v13TagE: __ZTVN6TagLib5ID3v13TagE,
          _ZTVN6TagLib5ID3v212ChapterFrameE: __ZTVN6TagLib5ID3v212ChapterFrameE,
          _ZTVN6TagLib5ID3v212FrameFactoryE: __ZTVN6TagLib5ID3v212FrameFactoryE,
          _ZTVN6TagLib5ID3v212PodcastFrameE: __ZTVN6TagLib5ID3v212PodcastFrameE,
          _ZTVN6TagLib5ID3v212PrivateFrameE: __ZTVN6TagLib5ID3v212PrivateFrameE,
          _ZTVN6TagLib5ID3v212UnknownFrameE: __ZTVN6TagLib5ID3v212UnknownFrameE,
          _ZTVN6TagLib5ID3v212UrlLinkFrameE: __ZTVN6TagLib5ID3v212UrlLinkFrameE,
          _ZTVN6TagLib5ID3v213CommentsFrameE:
            __ZTVN6TagLib5ID3v213CommentsFrameE,
          _ZTVN6TagLib5ID3v214ExtendedHeaderE:
            __ZTVN6TagLib5ID3v214ExtendedHeaderE,
          _ZTVN6TagLib5ID3v214OwnershipFrameE:
            __ZTVN6TagLib5ID3v214OwnershipFrameE,
          _ZTVN6TagLib5ID3v216UserUrlLinkFrameE:
            __ZTVN6TagLib5ID3v216UserUrlLinkFrameE,
          _ZTVN6TagLib5ID3v218PopularimeterFrameE:
            __ZTVN6TagLib5ID3v218PopularimeterFrameE,
          _ZTVN6TagLib5ID3v219Latin1StringHandlerE:
            __ZTVN6TagLib5ID3v219Latin1StringHandlerE,
          _ZTVN6TagLib5ID3v219RelativeVolumeFrameE:
            __ZTVN6TagLib5ID3v219RelativeVolumeFrameE,
          _ZTVN6TagLib5ID3v220AttachedPictureFrameE:
            __ZTVN6TagLib5ID3v220AttachedPictureFrameE,
          _ZTVN6TagLib5ID3v220TableOfContentsFrameE:
            __ZTVN6TagLib5ID3v220TableOfContentsFrameE,
          _ZTVN6TagLib5ID3v221EventTimingCodesFrameE:
            __ZTVN6TagLib5ID3v221EventTimingCodesFrameE,
          _ZTVN6TagLib5ID3v223AttachedPictureFrameV22E:
            __ZTVN6TagLib5ID3v223AttachedPictureFrameV22E,
          _ZTVN6TagLib5ID3v223SynchronizedLyricsFrameE:
            __ZTVN6TagLib5ID3v223SynchronizedLyricsFrameE,
          _ZTVN6TagLib5ID3v223TextIdentificationFrameE:
            __ZTVN6TagLib5ID3v223TextIdentificationFrameE,
          _ZTVN6TagLib5ID3v225UniqueFileIdentifierFrameE:
            __ZTVN6TagLib5ID3v225UniqueFileIdentifierFrameE,
          _ZTVN6TagLib5ID3v225UnsynchronizedLyricsFrameE:
            __ZTVN6TagLib5ID3v225UnsynchronizedLyricsFrameE,
          _ZTVN6TagLib5ID3v227UserTextIdentificationFrameE:
            __ZTVN6TagLib5ID3v227UserTextIdentificationFrameE,
          _ZTVN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE:
            __ZTVN6TagLib5ID3v230GeneralEncapsulatedObjectFrameE,
          _ZTVN6TagLib5ID3v23TagE: __ZTVN6TagLib5ID3v23TagE,
          _ZTVN6TagLib5ID3v25Frame6HeaderE: __ZTVN6TagLib5ID3v25Frame6HeaderE,
          _ZTVN6TagLib5ID3v25FrameE: __ZTVN6TagLib5ID3v25FrameE,
          _ZTVN6TagLib5ID3v26FooterE: __ZTVN6TagLib5ID3v26FooterE,
          _ZTVN6TagLib5ID3v26HeaderE: __ZTVN6TagLib5ID3v26HeaderE,
          _ZTVN6TagLib6DSDIFF10PropertiesE: __ZTVN6TagLib6DSDIFF10PropertiesE,
          _ZTVN6TagLib6DSDIFF4DIIN3TagE: __ZTVN6TagLib6DSDIFF4DIIN3TagE,
          _ZTVN6TagLib6DSDIFF4FileE: __ZTVN6TagLib6DSDIFF4FileE,
          _ZTVN6TagLib6Vorbis10PropertiesE: __ZTVN6TagLib6Vorbis10PropertiesE,
          _ZTVN6TagLib6Vorbis4FileE: __ZTVN6TagLib6Vorbis4FileE,
          _ZTVN6TagLib7FileRef16FileTypeResolverE:
            __ZTVN6TagLib7FileRef16FileTypeResolverE,
          _ZTVN6TagLib7FileRef18StreamTypeResolverE:
            __ZTVN6TagLib7FileRef18StreamTypeResolverE,
          _ZTVN6TagLib7WavPack10PropertiesE: __ZTVN6TagLib7WavPack10PropertiesE,
          _ZTVN6TagLib7WavPack4FileE: __ZTVN6TagLib7WavPack4FileE,
          _ZTVN6TagLib8IOStreamE: __ZTVN6TagLib8IOStreamE,
          _ZTVN6TagLib8TagUnionE: __ZTVN6TagLib8TagUnionE,
          _ZTVN6TagLib9TrueAudio10PropertiesE:
            __ZTVN6TagLib9TrueAudio10PropertiesE,
          _ZTVN6TagLib9TrueAudio4FileE: __ZTVN6TagLib9TrueAudio4FileE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3ASF7Picture14PicturePrivateENS_9allocatorIS4_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3ASF9Attribute16AttributePrivateENS_9allocatorIS4_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MP44Item11ItemPrivateENS_9allocatorIS4_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MP48CoverArt15CoverArtPrivateENS_9allocatorIS4_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapIKNS1_6StringENS1_3APE4ItemEE10MapPrivateIS4_S6_EENS_9allocatorIS9_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_3MP411ItemFactory15ItemHandlerTypeEE10MapPrivateIS3_S6_EENS_9allocatorIS9_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_4ListIPNS1_5ID3v25FrameEEEE10MapPrivateIS3_S8_EENS_9allocatorISB_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_10ByteVectorENS1_6StringEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_5ID3v219RelativeVolumeFrame11ChannelTypeE11ChannelDataE10MapPrivateIS5_S6_EENS_9allocatorIS9_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10ByteVectorEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_10StringListEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_3MP44ItemEE10MapPrivateIS3_S5_EENS_9allocatorIS8_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_4ListINS1_3ASF9AttributeEEEE10MapPrivateIS3_S7_EENS_9allocatorISA_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringENS1_7VariantEE10MapPrivateIS3_S4_EENS_9allocatorIS7_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringES3_E10MapPrivateIS3_S3_EENS_9allocatorIS6_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapINS1_6StringEiE10MapPrivateIS3_iEENS_9allocatorIS6_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib3MapIjNS1_10ByteVectorEE10MapPrivateIjS3_EENS_9allocatorIS6_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_10ByteVectorEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3APE4ItemEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3ASF9AttributeEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48AtomDataEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MP48CoverArtEE11ListPrivateIS4_EENS_9allocatorIS7_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_3MapINS1_6StringENS1_7VariantEEEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v219RelativeVolumeFrame11ChannelTypeEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v221EventTimingCodesFrame12SynchedEventEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_5ID3v223SynchronizedLyricsFrame11SynchedTextEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_6StringEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListINS1_7VariantEE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPKNS1_7FileRef16FileTypeResolverEE11ListPrivateIS6_EENS_9allocatorIS9_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3ASF4File11FilePrivate10BaseObjectEE11ListPrivateIS7_EENS_9allocatorISA_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3MP44AtomEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_3Ogg4PageEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC13MetadataBlockEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_4FLAC7PictureEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPNS1_5ID3v25FrameEE11ListPrivateIS5_EENS_9allocatorIS8_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIPcE11ListPrivateIS3_EENS_9allocatorIS6_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4ListIiE11ListPrivateIiEENS_9allocatorIS5_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib4MPEG6Header13HeaderPrivateENS_9allocatorIS4_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib6String13StringPrivateENS_9allocatorIS3_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib7FileRef14FileRefPrivateENS_9allocatorIS3_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceIN6TagLib7Variant14VariantPrivateENS_9allocatorIS3_EEEE,
          _ZTVNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE:
            __ZTVNSt3__220__shared_ptr_emplaceINS_6vectorIcNS_9allocatorIcEEEENS2_IS4_EEEE,
          _ZlsRNSt3__213basic_ostreamIcNS_11char_traitsIcEEEERKN6TagLib7VariantE:
            __ZlsRNSt3__213basic_ostreamIcNS_11char_traitsIcEEEERKN6TagLib7VariantE,
          __assert_fail: ___assert_fail,
          __cxa_throw: ___cxa_throw,
          __heap_base: ___heap_base,
          __indirect_function_table: wasmTable,
          __memory_base: ___memory_base,
          __stack_pointer: ___stack_pointer,
          __syscall_faccessat: ___syscall_faccessat,
          __syscall_fcntl64: ___syscall_fcntl64,
          __syscall_fstat64: ___syscall_fstat64,
          __syscall_ftruncate64: ___syscall_ftruncate64,
          __syscall_ioctl: ___syscall_ioctl,
          __syscall_lstat64: ___syscall_lstat64,
          __syscall_newfstatat: ___syscall_newfstatat,
          __syscall_openat: ___syscall_openat,
          __syscall_rmdir: ___syscall_rmdir,
          __syscall_stat64: ___syscall_stat64,
          __syscall_unlinkat: ___syscall_unlinkat,
          __table_base: ___table_base,
          _embind_finalize_value_object: __embind_finalize_value_object,
          _embind_register_bigint: __embind_register_bigint,
          _embind_register_bool: __embind_register_bool,
          _embind_register_emval: __embind_register_emval,
          _embind_register_float: __embind_register_float,
          _embind_register_function: __embind_register_function,
          _embind_register_integer: __embind_register_integer,
          _embind_register_memory_view: __embind_register_memory_view,
          _embind_register_std_string: __embind_register_std_string,
          _embind_register_std_wstring: __embind_register_std_wstring,
          _embind_register_value_object: __embind_register_value_object,
          _embind_register_value_object_field:
            __embind_register_value_object_field,
          _embind_register_void: __embind_register_void,
          _gmtime_js: __gmtime_js,
          _tzset_js: __tzset_js,
          abort: _abort,
          emscripten_date_now: _emscripten_date_now,
          emscripten_memcpy_js: _emscripten_memcpy_js,
          emscripten_resize_heap: _emscripten_resize_heap,
          environ_get: _environ_get,
          environ_sizes_get: _environ_sizes_get,
          exit: _exit,
          fd_close: _fd_close,
          fd_read: _fd_read,
          fd_seek: _fd_seek,
          fd_sync: _fd_sync,
          fd_write: _fd_write,
          g721_decoder: _g721_decoder,
          g721_encoder: _g721_encoder,
          g723_16_decoder: _g723_16_decoder,
          g723_16_encoder: _g723_16_encoder,
          g723_24_decoder: _g723_24_decoder,
          g723_24_encoder: _g723_24_encoder,
          g723_40_decoder: _g723_40_decoder,
          g723_40_encoder: _g723_40_encoder,
          gsm_DLB: _gsm_DLB,
          gsm_FAC: _gsm_FAC,
          gsm_NRFAC: _gsm_NRFAC,
          gsm_QLB: _gsm_QLB,
          memory: wasmMemory,
          psf_d2i_array: _psf_d2i_array,
          psf_d2i_clip_array: _psf_d2i_clip_array,
          psf_default_seek: _psf_default_seek,
          psf_f2i_array: _psf_f2i_array,
          psf_f2i_clip_array: _psf_f2i_clip_array,
          sf_close: _sf_close,
          sf_command: _sf_command,
          sf_errno: _sf_errno,
          sf_format_check: _sf_format_check,
          sf_get_chunk_data: _sf_get_chunk_data,
          sf_get_chunk_iterator: _sf_get_chunk_iterator,
          sf_get_chunk_size: _sf_get_chunk_size,
          sf_open: _sf_open,
          sf_readf_float: _sf_readf_float,
          sf_seek: _sf_seek,
          sf_set_chunk: _sf_set_chunk,
          sf_write_raw: _sf_write_raw,
          sf_writef_float: _sf_writef_float,
          src_delete: _src_delete,
          src_is_valid_ratio: _src_is_valid_ratio,
          src_new: _src_new,
          src_process: _src_process,
          src_strerror: _src_strerror,
          strftime_l: _strftime_l,
          taglib_audioproperties_bitrate: _taglib_audioproperties_bitrate,
          taglib_audioproperties_channels: _taglib_audioproperties_channels,
          taglib_audioproperties_length: _taglib_audioproperties_length,
          taglib_audioproperties_samplerate: _taglib_audioproperties_samplerate,
          taglib_file_audioproperties: _taglib_file_audioproperties,
          taglib_file_free: _taglib_file_free,
          taglib_file_new: _taglib_file_new,
          taglib_tag_free_strings: _taglib_tag_free_strings,
        },
        wasmExports = createWasm();
      (Module.___wasm_apply_data_relocs = () =>
        (Module.___wasm_apply_data_relocs =
          wasmExports.__wasm_apply_data_relocs)()),
        (Module._strncmp = (a, s, o) =>
          (Module._strncmp = wasmExports.strncmp)(a, s, o)),
        (Module.__ZdlPv = (a) => (Module.__ZdlPv = wasmExports._ZdlPv)(a)),
        (Module._strrchr = (a, s) =>
          (Module._strrchr = wasmExports.strrchr)(a, s)),
        (Module._fopen = (a, s) => (Module._fopen = wasmExports.fopen)(a, s)),
        (Module._fseek = (a, s, o) =>
          (Module._fseek = wasmExports.fseek)(a, s, o)),
        (Module._fclose = (a) => (Module._fclose = wasmExports.fclose)(a)),
        (Module._fread = (a, s, o, _) =>
          (Module._fread = wasmExports.fread)(a, s, o, _)),
        (Module._ftell = (a) => (Module._ftell = wasmExports.ftell)(a)),
        (Module.__Znwm = (a) => (Module.__Znwm = wasmExports._Znwm)(a));
      var _malloc = (Module._malloc = (a) =>
        (_malloc = Module._malloc = wasmExports.malloc)(a));
      (Module.___cxa_allocate_exception = (a) =>
        (Module.___cxa_allocate_exception =
          wasmExports.__cxa_allocate_exception)(a)),
        (Module.__ZNSt12length_errorD1Ev = (a) =>
          (Module.__ZNSt12length_errorD1Ev =
            wasmExports._ZNSt12length_errorD1Ev)(a)),
        (Module.__ZNSt11logic_errorC2EPKc = (a, s) =>
          (Module.__ZNSt11logic_errorC2EPKc =
            wasmExports._ZNSt11logic_errorC2EPKc)(a, s)),
        (Module._strlen = (a) => (Module._strlen = wasmExports.strlen)(a)),
        (Module._puts = (a) => (Module._puts = wasmExports.puts)(a)),
        (Module._iprintf = (a, s) =>
          (Module._iprintf = wasmExports.iprintf)(a, s));
      var ___getTypeName = (a) =>
        (___getTypeName = wasmExports.__getTypeName)(a);
      (Module._strdup = (a) => (Module._strdup = wasmExports.strdup)(a)),
        (Module.__ZNSt9exceptionD2Ev = (a) =>
          (Module.__ZNSt9exceptionD2Ev = wasmExports._ZNSt9exceptionD2Ev)(a));
      var ___errno_location = () =>
        (___errno_location = wasmExports.__errno_location)();
      (Module._fdopen = (a, s) => (Module._fdopen = wasmExports.fdopen)(a, s)),
        (Module._access = (a, s) =>
          (Module._access = wasmExports.access)(a, s));
      var ___funcs_on_exit = () =>
        (___funcs_on_exit = wasmExports.__funcs_on_exit)();
      (Module.___cxa_atexit = (a, s, o) =>
        (Module.___cxa_atexit = wasmExports.__cxa_atexit)(a, s, o)),
        (Module._clearerr = (a) =>
          (Module._clearerr = wasmExports.clearerr)(a)),
        (Module._close = (a) => (Module._close = wasmExports.close)(a)),
        (Module._memmove = (a, s, o) =>
          (Module._memmove = wasmExports.memmove)(a, s, o)),
        (Module._memset = (a, s, o) =>
          (Module._memset = wasmExports.memset)(a, s, o)),
        (Module._time = (a) => (Module._time = wasmExports.time)(a)),
        (Module._gettimeofday = (a, s) =>
          (Module._gettimeofday = wasmExports.gettimeofday)(a, s));
      var _fflush = (Module._fflush = (a) =>
          (_fflush = Module._fflush = wasmExports.fflush)(a)),
        _free = (Module._free = (a) =>
          (_free = Module._free = wasmExports.free)(a));
      (Module._fmod = (a, s) => (Module._fmod = wasmExports.fmod)(a, s)),
        (Module._fiprintf = (a, s, o) =>
          (Module._fiprintf = wasmExports.fiprintf)(a, s, o)),
        (Module._frexp = (a, s) => (Module._frexp = wasmExports.frexp)(a, s)),
        (Module._fstat = (a, s) => (Module._fstat = wasmExports.fstat)(a, s)),
        (Module._fsync = (a) => (Module._fsync = wasmExports.fsync)(a)),
        (Module._ftruncate = (a, s, o) =>
          (Module._ftruncate = wasmExports.ftruncate)(a, s, o)),
        (Module._fwrite = (a, s, o, _) =>
          (Module._fwrite = wasmExports.fwrite)(a, s, o, _)),
        (Module._getenv = (a) => (Module._getenv = wasmExports.getenv)(a)),
        (Module._isprint = (a) => (Module._isprint = wasmExports.isprint)(a)),
        (Module._ldexp = (a, s) => (Module._ldexp = wasmExports.ldexp)(a, s)),
        (Module._ldexpl = (a, s, o, _, c, d) =>
          (Module._ldexpl = wasmExports.ldexpl)(a, s, o, _, c, d)),
        (Module._log10 = (a) => (Module._log10 = wasmExports.log10)(a)),
        (Module._lrint = (a) => (Module._lrint = wasmExports.lrint)(a)),
        (Module._lrintf = (a) => (Module._lrintf = wasmExports.lrintf)(a)),
        (Module._lseek = (a, s, o, _) =>
          (Module._lseek = wasmExports.lseek)(a, s, o, _)),
        (Module._gmtime_r = (a, s) =>
          (Module._gmtime_r = wasmExports.gmtime_r)(a, s)),
        (Module._open = (a, s, o) =>
          (Module._open = wasmExports.open)(a, s, o)),
        (Module._putchar = (a) => (Module._putchar = wasmExports.putchar)(a)),
        (Module._read = (a, s, o) =>
          (Module._read = wasmExports.read)(a, s, o)),
        (Module._remove = (a) => (Module._remove = wasmExports.remove)(a)),
        (Module._snprintf = (a, s, o, _) =>
          (Module._snprintf = wasmExports.snprintf)(a, s, o, _)),
        (Module._sscanf = (a, s, o) =>
          (Module._sscanf = wasmExports.sscanf)(a, s, o)),
        (Module._stat = (a, s) => (Module._stat = wasmExports.stat)(a, s)),
        (Module._strcmp = (a, s) =>
          (Module._strcmp = wasmExports.strcmp)(a, s)),
        (Module._strerror = (a) =>
          (Module._strerror = wasmExports.strerror)(a)),
        (Module._strncat = (a, s, o) =>
          (Module._strncat = wasmExports.strncat)(a, s, o)),
        (Module._strncpy = (a, s, o) =>
          (Module._strncpy = wasmExports.strncpy)(a, s, o)),
        (Module._strnlen = (a, s) =>
          (Module._strnlen = wasmExports.strnlen)(a, s)),
        (Module._strstr = (a, s) =>
          (Module._strstr = wasmExports.strstr)(a, s)),
        (Module._strtol = (a, s, o) =>
          (Module._strtol = wasmExports.strtol)(a, s, o)),
        (Module._tolower = (a) => (Module._tolower = wasmExports.tolower)(a)),
        (Module._vsnprintf = (a, s, o, _) =>
          (Module._vsnprintf = wasmExports.vsnprintf)(a, s, o, _)),
        (Module._wcslen = (a) => (Module._wcslen = wasmExports.wcslen)(a)),
        (Module._wcstol = (a, s, o) =>
          (Module._wcstol = wasmExports.wcstol)(a, s, o)),
        (Module._wmemchr = (a, s, o) =>
          (Module._wmemchr = wasmExports.wmemchr)(a, s, o)),
        (Module._wmemcmp = (a, s, o) =>
          (Module._wmemcmp = wasmExports.wmemcmp)(a, s, o)),
        (Module._write = (a, s, o) =>
          (Module._write = wasmExports.write)(a, s, o)),
        (Module._calloc = (a, s) =>
          (Module._calloc = wasmExports.calloc)(a, s)),
        (Module._realloc = (a, s) =>
          (Module._realloc = wasmExports.realloc)(a, s)),
        (Module.___addtf3 = (a, s, o, _, c, d, g, b, h) =>
          (Module.___addtf3 = wasmExports.__addtf3)(a, s, o, _, c, d, g, b, h)),
        (Module.___getf2 = (a, s, o, _, c, d, g, b) =>
          (Module.___getf2 = wasmExports.__getf2)(a, s, o, _, c, d, g, b)),
        (Module.___divtf3 = (a, s, o, _, c, d, g, b, h) =>
          (Module.___divtf3 = wasmExports.__divtf3)(a, s, o, _, c, d, g, b, h));
      var _setThrew = (a, s) => (_setThrew = wasmExports.setThrew)(a, s);
      (Module.___extenddftf2 = (a, s) =>
        (Module.___extenddftf2 = wasmExports.__extenddftf2)(a, s)),
        (Module.___fixtfsi = (a, s, o, _) =>
          (Module.___fixtfsi = wasmExports.__fixtfsi)(a, s, o, _)),
        (Module.___floatunditf = (a, s, o) =>
          (Module.___floatunditf = wasmExports.__floatunditf)(a, s, o));
      var stackSave = () => (stackSave = wasmExports.stackSave)(),
        stackRestore = (a) => (stackRestore = wasmExports.stackRestore)(a),
        stackAlloc = (a) => (stackAlloc = wasmExports.stackAlloc)(a);
      (Module.___trunctfdf2 = (a, s, o, _) =>
        (Module.___trunctfdf2 = wasmExports.__trunctfdf2)(a, s, o, _)),
        (Module.__ZNSt3__29basic_iosIcNS_11char_traitsIcEEED2Ev = (a) =>
          (Module.__ZNSt3__29basic_iosIcNS_11char_traitsIcEEED2Ev =
            wasmExports._ZNSt3__29basic_iosIcNS_11char_traitsIcEEED2Ev)(a)),
        (Module.__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEED2Ev = (a) =>
          (Module.__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEED2Ev =
            wasmExports._ZNSt3__215basic_streambufIcNS_11char_traitsIcEEED2Ev)(
            a
          )),
        (Module.__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEEC2Ev = (a) =>
          (Module.__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEEC2Ev =
            wasmExports._ZNSt3__215basic_streambufIcNS_11char_traitsIcEEEC2Ev)(
            a
          )),
        (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEi = (a, s) =>
          (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEi =
            wasmExports._ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEi)(
            a,
            s
          )),
        (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEj = (a, s) =>
          (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEj =
            wasmExports._ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEj)(
            a,
            s
          )),
        (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEx = (
          a,
          s,
          o
        ) =>
          (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEx =
            wasmExports._ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEx)(
            a,
            s,
            o
          )),
        (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEy = (
          a,
          s,
          o
        ) =>
          (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEy =
            wasmExports._ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEy)(
            a,
            s,
            o
          )),
        (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEd = (a, s) =>
          (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEd =
            wasmExports._ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEd)(
            a,
            s
          )),
        (Module.__ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED2Ev = (
          a,
          s
        ) =>
          (Module.__ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED2Ev =
            wasmExports._ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED2Ev)(
            a,
            s
          )),
        (Module.__ZNKSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE3strEv =
          (a, s) =>
            (Module.__ZNKSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE3strEv =
              wasmExports._ZNKSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE3strEv)(
              a,
              s
            )),
        (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryC1ERS3_ =
          (a, s) =>
            (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryC1ERS3_ =
              wasmExports._ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryC1ERS3_)(
              a,
              s
            )),
        (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryD1Ev = (
          a
        ) =>
          (Module.__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryD1Ev =
            wasmExports._ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryD1Ev)(
            a
          )),
        (Module.__ZNKSt3__28ios_base6getlocEv = (a, s) =>
          (Module.__ZNKSt3__28ios_base6getlocEv =
            wasmExports._ZNKSt3__28ios_base6getlocEv)(a, s)),
        (Module.__ZNSt3__28ios_base5clearEj = (a, s) =>
          (Module.__ZNSt3__28ios_base5clearEj =
            wasmExports._ZNSt3__28ios_base5clearEj)(a, s)),
        (Module.__ZNSt3__28ios_base4initEPv = (a, s) =>
          (Module.__ZNSt3__28ios_base4initEPv =
            wasmExports._ZNSt3__28ios_base4initEPv)(a, s)),
        (Module.__ZNKSt3__26locale9use_facetERNS0_2idE = (a, s) =>
          (Module.__ZNKSt3__26locale9use_facetERNS0_2idE =
            wasmExports._ZNKSt3__26locale9use_facetERNS0_2idE)(a, s)),
        (Module.__ZNSt3__26localeD1Ev = (a) =>
          (Module.__ZNSt3__26localeD1Ev = wasmExports._ZNSt3__26localeD1Ev)(a)),
        (Module.__ZNSt3__219__shared_weak_count14__release_weakEv = (a) =>
          (Module.__ZNSt3__219__shared_weak_count14__release_weakEv =
            wasmExports._ZNSt3__219__shared_weak_count14__release_weakEv)(a)),
        (Module.__ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info =
          (a, s) =>
            (Module.__ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info =
              wasmExports._ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info)(
              a,
              s
            )),
        (Module.__ZNSt3__219__shared_weak_countD2Ev = (a) =>
          (Module.__ZNSt3__219__shared_weak_countD2Ev =
            wasmExports._ZNSt3__219__shared_weak_countD2Ev)(a)),
        (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE25__init_copy_ctor_externalEPKwm =
          (a, s, o) =>
            (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE25__init_copy_ctor_externalEPKwm =
              wasmExports._ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE25__init_copy_ctor_externalEPKwm)(
              a,
              s,
              o
            )),
        (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE7reserveEm =
          (a, s) =>
            (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE7reserveEm =
              wasmExports._ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE7reserveEm)(
              a,
              s
            )),
        (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6appendEPKwm =
          (a, s, o) =>
            (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6appendEPKwm =
              wasmExports._ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6appendEPKwm)(
              a,
              s,
              o
            )),
        (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw =
          (a, s) =>
            (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw =
              wasmExports._ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw)(
              a,
              s
            )),
        (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6appendEPKw =
          (a, s) =>
            (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6appendEPKw =
              wasmExports._ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6appendEPKw)(
              a,
              s
            )),
        (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6resizeEmw =
          (a, s, o) =>
            (Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6resizeEmw =
              wasmExports._ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6resizeEmw)(
              a,
              s,
              o
            )),
        (Module.__ZNSt3__29to_stringEi = (a, s) =>
          (Module.__ZNSt3__29to_stringEi = wasmExports._ZNSt3__29to_stringEi)(
            a,
            s
          )),
        (Module.__ZNSt3__29to_stringEx = (a, s, o) =>
          (Module.__ZNSt3__29to_stringEx = wasmExports._ZNSt3__29to_stringEx)(
            a,
            s,
            o
          )),
        (Module.___cxa_pure_virtual = () =>
          (Module.___cxa_pure_virtual = wasmExports.__cxa_pure_virtual)()),
        (Module.___dynamic_cast = (a, s, o, _) =>
          (Module.___dynamic_cast = wasmExports.__dynamic_cast)(a, s, o, _));
      var ___cxa_is_pointer_type = (a) =>
        (___cxa_is_pointer_type = wasmExports.__cxa_is_pointer_type)(a);
      (Module.__ZNSt20bad_array_new_lengthC1Ev = (a) =>
        (Module.__ZNSt20bad_array_new_lengthC1Ev =
          wasmExports._ZNSt20bad_array_new_lengthC1Ev)(a)),
        (Module.__ZNSt20bad_array_new_lengthD1Ev = (a) =>
          (Module.__ZNSt20bad_array_new_lengthD1Ev =
            wasmExports._ZNSt20bad_array_new_lengthD1Ev)(a)),
        (Module.__ZNSt12out_of_rangeD1Ev = (a) =>
          (Module.__ZNSt12out_of_rangeD1Ev =
            wasmExports._ZNSt12out_of_rangeD1Ev)(a)),
        (Module.dynCall_jiji = (a, s, o, _, c) =>
          (Module.dynCall_jiji = wasmExports.dynCall_jiji)(a, s, o, _, c)),
        (Module.dynCall_iiiiij = (a, s, o, _, c, d, g) =>
          (Module.dynCall_iiiiij = wasmExports.dynCall_iiiiij)(
            a,
            s,
            o,
            _,
            c,
            d,
            g
          )),
        (Module.dynCall_iiiiijj = (a, s, o, _, c, d, g, b, h) =>
          (Module.dynCall_iiiiijj = wasmExports.dynCall_iiiiijj)(
            a,
            s,
            o,
            _,
            c,
            d,
            g,
            b,
            h
          )),
        (Module.dynCall_iiiiiijj = (a, s, o, _, c, d, g, b, h, j) =>
          (Module.dynCall_iiiiiijj = wasmExports.dynCall_iiiiiijj)(
            a,
            s,
            o,
            _,
            c,
            d,
            g,
            b,
            h,
            j
          )),
        (Module.dynCall_viijii = (a, s, o, _, c, d, g) =>
          (Module.dynCall_viijii = wasmExports.dynCall_viijii)(
            a,
            s,
            o,
            _,
            c,
            d,
            g
          )),
        (Module._orig$time = (a) =>
          (Module._orig$time = wasmExports.orig$time)(a)),
        (Module._orig$ftruncate = (a, s) =>
          (Module._orig$ftruncate = wasmExports.orig$ftruncate)(a, s)),
        (Module._orig$ldexpl = (a, s, o, _) =>
          (Module._orig$ldexpl = wasmExports.orig$ldexpl)(a, s, o, _)),
        (Module._orig$lseek = (a, s, o) =>
          (Module._orig$lseek = wasmExports.orig$lseek)(a, s, o)),
        (Module._orig$__addtf3 = (a, s, o, _, c) =>
          (Module._orig$__addtf3 = wasmExports.orig$__addtf3)(a, s, o, _, c)),
        (Module._orig$__getf2 = (a, s, o, _) =>
          (Module._orig$__getf2 = wasmExports.orig$__getf2)(a, s, o, _)),
        (Module._orig$__divtf3 = (a, s, o, _, c) =>
          (Module._orig$__divtf3 = wasmExports.orig$__divtf3)(a, s, o, _, c)),
        (Module._orig$__fixtfsi = (a, s) =>
          (Module._orig$__fixtfsi = wasmExports.orig$__fixtfsi)(a, s)),
        (Module._orig$__floatunditf = (a, s) =>
          (Module._orig$__floatunditf = wasmExports.orig$__floatunditf)(a, s)),
        (Module._orig$__trunctfdf2 = (a, s) =>
          (Module._orig$__trunctfdf2 = wasmExports.orig$__trunctfdf2)(a, s)),
        (Module._orig$_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEx = (
          a,
          s
        ) =>
          (Module._orig$_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEx =
            wasmExports.orig$_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEx)(
            a,
            s
          )),
        (Module._orig$_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEy = (
          a,
          s
        ) =>
          (Module._orig$_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEy =
            wasmExports.orig$_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEy)(
            a,
            s
          )),
        (Module._orig$_ZNSt3__29to_stringEx = (a, s) =>
          (Module._orig$_ZNSt3__29to_stringEx =
            wasmExports.orig$_ZNSt3__29to_stringEx)(a, s)),
        (Module.__ZTVN10__cxxabiv117__class_type_infoE = 20388),
        (Module.__ZTISt12length_error = 17264),
        (Module.__ZTVSt12length_error = 17244),
        (Module.__ZTISt18bad_variant_access = 16912),
        (Module.__ZTVSt18bad_variant_access = 16892),
        (Module._stderr = 21140),
        (Module.__ZTVNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEEE = 20324),
        (Module.__ZTVNSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEEE = 20592),
        (Module.__ZTTNSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEEE = 20652),
        (Module.__ZNSt3__24cerrE = 60104),
        (Module.__ZNSt3__25ctypeIcE2idE = 58640),
        (Module.__ZTINSt3__219__shared_weak_countE = 17396),
        (Module.__ZTISt9exception = 17420),
        (Module.__ZTVN10__cxxabiv120__si_class_type_infoE = 21208),
        (Module.__ZTISt20bad_array_new_length = 17212),
        (Module.__ZTVSt12out_of_range = 17276),
        (Module.__ZTISt12out_of_range = 17296),
        (Module.addRunDependency = addRunDependency),
        (Module.removeRunDependency = removeRunDependency),
        (Module.FS_createPath = FS.createPath),
        (Module.FS_createLazyFile = FS.createLazyFile),
        (Module.FS_createDevice = FS.createDevice),
        (Module.ccall = ccall),
        (Module.cwrap = cwrap),
        (Module.FS_createPreloadedFile = FS.createPreloadedFile),
        (Module.FS_createDataFile = FS.createDataFile),
        (Module.FS_unlink = FS.unlink);
      var calledRun;
      dependenciesFulfilled = function a() {
        calledRun || run(), calledRun || (dependenciesFulfilled = a);
      };
      function callMain(a = []) {
        var s = resolveGlobalSymbol("main").sym;
        if (s) {
          a.unshift(thisProgram);
          var o = a.length,
            _ = stackAlloc((o + 1) * 4),
            c = _;
          a.forEach((g) => {
            (HEAPU32[c >> 2] = stringToUTF8OnStack(g)), (c += 4);
          }),
            (HEAPU32[c >> 2] = 0);
          try {
            var d = s(o, _);
            return exitJS(d, !0), d;
          } catch (g) {
            return handleException(g);
          }
        }
      }
      function run(a = arguments_) {
        if (runDependencies > 0 || (preRun(), runDependencies > 0)) return;
        function s() {
          calledRun ||
            ((calledRun = !0),
            (Module.calledRun = !0),
            !ABORT &&
              (initRuntime(),
              preMain(),
              readyPromiseResolve(Module),
              Module.onRuntimeInitialized && Module.onRuntimeInitialized(),
              shouldRunNow && callMain(a),
              postRun()));
        }
        Module.setStatus
          ? (Module.setStatus("Running..."),
            setTimeout(function () {
              setTimeout(function () {
                Module.setStatus("");
              }, 1),
                s();
            }, 1))
          : s();
      }
      if (Module.preInit)
        for (
          typeof Module.preInit == "function" &&
          (Module.preInit = [Module.preInit]);
          Module.preInit.length > 0;

        )
          Module.preInit.pop()();
      var shouldRunNow = !0;
      return (
        Module.noInitialRun && (shouldRunNow = !1),
        run(),
        (Module.onRuntimeInitialized = function () {
          (Module.createWav = function (a, s, o) {
            let _;
            try {
              (s.extra.data_start = 0),
                (s.extra.data_end = 0),
                Module.create_wav(a, s, new Uint8Array(o)),
                (_ = Module.FS.readFile(a, {
                  encoding: "binary",
                }));
            } finally {
              try {
                Module.FS.unlink(a);
              } catch {}
            }
            return _;
          }),
            (Module.getWavMeta = function (a, s) {
              Module.FS.writeFile(a, new Uint8Array(s));
              try {
                return Module.extract_wav_meta(a);
              } finally {
                try {
                  Module.FS.unlink(a);
                } catch {}
              }
            }),
            (Module.getAudioMeta = function (a, s) {
              Module.FS.writeFile(a, new Uint8Array(s));
              try {
                return Module.get_audio_meta(a);
              } finally {
                try {
                  Module.FS.unlink(a);
                } catch {}
              }
            }),
            (Module.resampleAudioData = async function (a, s, o, _, c, d, g) {
              const [b, h] = [`input.${_}`, `output.${c}`];
              Module.FS.writeFile(b, new Uint8Array(a), {
                encoding: "binary",
              });
              let j;
              try {
                Module.resample(b, h, s, o, d, g),
                  (j = Module.FS.readFile(h, {
                    encoding: "binary",
                  }));
              } finally {
                try {
                  Module.FS.unlink(b), Module.FS.unlink(h);
                } catch {}
              }
              return j;
            });
        }),
        moduleArg.ready
      );
    };


export default createResampleModule;
