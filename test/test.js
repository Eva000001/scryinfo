
var Scry = require("../lib/scry.js");
var scry = new Scry("http://192.168.10.49:8545");

scry.start((b) => {
    if(!b) return;

    // testGetEth();
    testCreateAccount();
});

function testGetEth(){
    var v = scry.eth.getBalance(scry.getAccounts(true)[0]);
    console.log(v.toNumber());
}

function testCreateAccount(){
    var act = scry.newAccount("test");
    console.log(act);
}
