"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const common_1 = require("@nestjs/common");
let AgentController = (() => {
    let _classDecorators = [(0, common_1.Controller)('agent')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _register_decorators;
    let _heartbeat_decorators;
    let _systemInfo_decorators;
    let _syncPlugins_decorators;
    let _syncThemes_decorators;
    let _syncCore_decorators;
    var AgentController = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _register_decorators = [(0, common_1.Post)('register')];
            _heartbeat_decorators = [(0, common_1.Post)('heartbeat')];
            _systemInfo_decorators = [(0, common_1.Post)('system-info')];
            _syncPlugins_decorators = [(0, common_1.Post)('sync/plugins')];
            _syncThemes_decorators = [(0, common_1.Post)('sync/themes')];
            _syncCore_decorators = [(0, common_1.Post)('sync/core')];
            __esDecorate(this, null, _register_decorators, { kind: "method", name: "register", static: false, private: false, access: { has: obj => "register" in obj, get: obj => obj.register }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _heartbeat_decorators, { kind: "method", name: "heartbeat", static: false, private: false, access: { has: obj => "heartbeat" in obj, get: obj => obj.heartbeat }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _systemInfo_decorators, { kind: "method", name: "systemInfo", static: false, private: false, access: { has: obj => "systemInfo" in obj, get: obj => obj.systemInfo }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _syncPlugins_decorators, { kind: "method", name: "syncPlugins", static: false, private: false, access: { has: obj => "syncPlugins" in obj, get: obj => obj.syncPlugins }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _syncThemes_decorators, { kind: "method", name: "syncThemes", static: false, private: false, access: { has: obj => "syncThemes" in obj, get: obj => obj.syncThemes }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _syncCore_decorators, { kind: "method", name: "syncCore", static: false, private: false, access: { has: obj => "syncCore" in obj, get: obj => obj.syncCore }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            AgentController = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        agentService = __runInitializers(this, _instanceExtraInitializers);
        constructor(agentService) {
            this.agentService = agentService;
        }
        register(body) { return this.agentService.register(); }
        heartbeat(body) { return this.agentService.heartbeat(); }
        systemInfo(body) { return { success: true, payload: body }; }
        syncPlugins(body) { return { success: true, payload: body }; }
        syncThemes(body) { return { success: true, payload: body }; }
        syncCore(body) { return { success: true, payload: body }; }
    };
    return AgentController = _classThis;
})();
exports.AgentController = AgentController;
