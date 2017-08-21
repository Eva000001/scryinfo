/**
    callback或事件回调的参数, 是统一的格式:
    {
        st: ScryStatusCode.xx, // @see{ScryStatusCode}
        msg: "", // 错误或提示信息
        error: error object, // 错误时,返回的error对象
        data: object // web3返回的一些具体结果对象
    }

    @author Danny Yan
    @date 2017-08
*/
var path = require("path");
var fs = require("fs");
var Web3 = require("web3");
var util = require('util');
var events = require('events');
var base58 = require('base-58'); // npm install base-58
var concat = require('concat-stream');
var keythereum = require("keythereum");
var Tx = require('ethereumjs-tx');
var StatusCode = require("./scryStatusCode.js");

function Scry(providerURL) {
    var web3 = this.web3 = new Web3();
    this.eth = web3.eth;
    this.personal = web3.personal;
    this.admin = web3.admin;
    this.providerURL = providerURL;
    this._accountsDirty = true;
    this.accounts = this.getAccounts();
}

util.inherits(Scry, events.EventEmitter);

Scry.prototype.start = function(callback) {
    this.web3.setProvider(new Web3.providers.HttpProvider(this.providerURL, 0));
    var isOK = this.web3.isConnected(); // 这里是同步阻塞
    console.log("scry start successfully.");
    callback(isOK);
};

Scry.prototype.newAccount = function(password) {
    if (password == null || typeof(password) != "string" || password.length < 3) {
        throw new Error("the password must be a string and length > 2.")
        return;
    }
    var keyObject = this._createKeyObject(String(password));
    this._saveKeyObject(keyObject);

    this._accountsDirty = true;

    var list = this.getAccounts(true);
    return list[list.length - 1];
};

Scry.prototype.getAccounts = function(strict) {
    if (this._accountsDirty == false) {
        if (strict && this.accounts.length < 1) {
            throw new Error("accounts is empty.");
        }
        return this.accounts;
    }
    var dir = path.resolve(__dirname + "/keystore/");
    if (fs.existsSync(dir) == false) {
        fs.mkdir(dir);
    }
    console.log(); // ? install by npm, it will be wrong on first run!!
    var files = fs.readdirSync(dir);

    var list = [];

    for (var i = 0, len = files.length; i < len; i++) {
        var data = fs.readFileSync(dir + "\\" + files[i]);
        var keyObject = JSON.parse(data.toString());

        list.push("0x" + keyObject.address);
    }

    this._accountsDirty = false;
    this.accounts = list;

    if (strict && list.length < 1) {
        throw new Error("accounts is empty.");
    }

    return list;
};

/**
    获取eth余额
*/
Scry.prototype.getBalance = function(from, toWei) {
    if (toWei == null) toWei = true;
    var val = this.eth.getBalance(from).toNumber();
    return toWei ? val : this.web3.fromWei(val);
};

/**
    Get a instance of contract by address and abi.
    @param address string.
    @param abi string.
    @return object
*/
Scry.prototype.getContractInstance = function(address, abi) {
    if (typeof(address) != "string" || typeof(abi) != "string") {
        throw new Error("address or abi is null.");
    }
    var abiObj = typeof(abi) == "string" ? JSON.parse(abi) : abi;
    var _contract = this.eth.contract(abiObj);
    var _contractInst = _contract.at(address);
    return _contractInst;
};

/**
    监听事件
    @param eventFunc web3 function object.
    @param txHash string. 如果指定此值,则只有事件返回的transactionHash与其相等时才会触发回调
    @param callback function.
*/
Scry.prototype.watchEvent = function(eventFunc, txHash, callback) {
    if (eventFunc == null || typeof(eventFunc) != "function") {
        throw new Error("eventFunc must be a function type.");
        return;
    }

    var myEvent = eventFunc();
    myEvent.watch(function(err, result) {
        if (err == null) {
            if (txHash == null) {
                typeof(callback) == "function" && callback({ st: StatusCode.OK, data: result });
            } else if (result.transactionHash == txHash) {
                typeof(callback) == "function" && callback({ st: StatusCode.OK, data: result });
            }
            // console.log("myEvent:",result);
        } else {
            // console.log("myEvent err: ", err);
            typeof(callback) == "function" && callback({ st: StatusCode.ERROR, msg: err.toString(), error: err });
        }
        myEvent.stopWatching();
    });
};

/**
    获取一个指定地址上的日志(事件结果)
    @param address string.
    @param fromBlock number|string. 指定的起始区块号. 可不填,默认为"latest"
    @param toBlock number|string. 指定的结束区块号. 可不填,默认为"latest"
    @param callback function.
*/
Scry.prototype.getLogs = function(address, fromBlock, toBlock, callback) {
    var filter = this.eth.filter({ address: address, fromBlock: fromBlock || "latest", toBlock: toBlock || 'latest' });
    var myResults = filter.get(function(err, rs) {
        if (err != null) {
            typeof(callback) == "function" && callback({ st: StatusCode.ERROR, msg: err.toString(), error: err });
            return;
        }
        typeof(callback) == "function" && callback({ st: StatusCode.OK, data: rs });
    });
};
Scry.prototype.getEvents = function(contractInst, fromBlock, toBlock, callback) {
    var events = null;
    events = contractInst.allEvents({ address: contractInst.address, fromBlock: fromBlock || "latest", toBlock: toBlock || 'latest' }, function(err, rs) {
        if (err != null) {
            typeof(callback) == "function" && callback({ st: StatusCode.ERROR, msg: err.toString(), error: err });
            return;
        }
        typeof(callback) == "function" && callback({ st: StatusCode.OK, data: rs });
        events.stopWatching();
    });
};


Scry.prototype.loadContentFromFile = function(p) {
    p = path.resolve(p);
    if (fs.existsSync(p) == false) return null;
    var cnt = fs.readFileSync(p);
    return cnt.toString();
};

/**
    通过transactionHash查询交易结果. 会循环阻塞
    @param transHash string.
    @param callback function.
    @param block bool. 是否要循环调用,直到获取到交易结果后才触发callback. 默认true
    @param blockInterval number. 阻塞间隔时间. 默认500ms
*/
Scry.prototype.waitForTransactionReceipt = function(transHash, callback, block, blockInterval) {
    if (block == null) block = true;
    if (blockInterval == null) blockInterval = 500;

    // Get contract information from transaction hash.
    var receipt = this.eth.getTransactionReceipt(transHash);
    // If no receipt, try again.
    if (receipt == null) {
        if (block) {
            setTimeout(() => {
                this.waitForTransactionReceipt(transHash, callback, block, blockInterval);
            }, blockInterval < 0 ? 0 : blockInterval);
        }
    } else {
        // The transaction was mined, we can retrieve the contract address.
        typeof(callback) == "function" && callback({ st: StatusCode.OK, data: receipt });
    }
}


// ---------- private ----------
/**
    创建private key obejct
    @param options object.
        {
            kdf: "pbkdf2" or "scrypt"
        }
*/
Scry.prototype._createKeyObject = function(password, options) {
    var params = { keyBytes: 32, ivBytes: 16 };
    var dk = keythereum.create(params);
    // if options is unspecified, the values in keythereum.constants are used.
    var options = options || {
        kdf: "pbkdf2",
        cipher: "aes-128-ctr",
        kdfparams: {
            c: 262144,
            dklen: 32,
            prf: "hmac-sha256"
        }
    };
    var keyObject = keythereum.dump(password, dk.privateKey, dk.salt, dk.iv, options);
    return keyObject;
};
/**
    保存到私钥
*/
Scry.prototype._saveKeyObject = function(keyObject) {
    var dir = path.resolve(__dirname + "/keystore/");
    if (fs.existsSync(dir) == false) {
        fs.mkdir(dir);
    }

    var address = keyObject.address;
    var date = new Date();
    var y = this._fmtNum(date.getUTCFullYear());
    var M = this._fmtNum(date.getUTCMonth());
    var d = this._fmtNum(date.getUTCDay());
    var h = this._fmtNum(date.getUTCHours());
    var m = this._fmtNum(date.getUTCMinutes());
    var s = this._fmtNum(date.getUTCSeconds());
    var ms = date.getUTCMilliseconds();
    var fmtAddress = "UTC--" + y + "-" + M + "-" + d + "T" + h + "-" + m + "-" + s + "." + ms + "Z--" + address;

    var p = dir + "/" + fmtAddress;
    if (fs.existsSync(p)) return;

    fs.writeFileSync(p, JSON.stringify(keyObject));
};
Scry.prototype._fmtNum = function(v) {
    return (v < 10 ? "0" : "") + v;
};

Scry.prototype._rawTrans = function(serializedTx, callback) {
    var rs = this.eth.sendRawTransaction("0x" + serializedTx.toString('hex'), function(err, hash) {
        if (err != null) {
            typeof(callback) == "function" && callback({ st: StatusCode.ERROR, msg: err.toString(), error: err });
            return;
        }

        typeof(callback) == "function" && callback({ st: StatusCode.OK, data: hash });
    });
    return rs;
};
Scry.prototype._buildRawTx = function(from, to, payloadData, value, gasLimit) {
    var web3 = this.web3;
    var eth = web3.eth;
    var nonce = eth.getTransactionCount(from);
    var nonceHex = web3.toHex(nonce);

    var gasPrice = eth.gasPrice;
    var gasPriceHex = web3.toHex(gasPrice);

    var gasLimitHex = web3.toHex(gasLimit || 4712388);
    if (value == null) value = 0;

    var rawTx = {
        nonce: nonceHex,
        gasPrice: gasPriceHex,
        gasLimit: gasLimitHex,
        to: to,
        from: from,
        value: web3.toHex(value),
        data: payloadData
        // chainId: 15 // 0:eth main net  1:eth test net
    };
    return rawTx;
};

module.exports = Scry;