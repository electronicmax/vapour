// vapour router and tracker (c) 2012 electronic max
// http://hip.cat/vapour
// licensed under the MIT License 

var sys = require ('sys'),
    url = require('url'),
    http = require('http'),
    und = require('./underscore.js'),
    qs = require('querystring');

var relay_id = 'hello-relay-' + new Date().valueOf();

var clients = {};
var seeds = {};
var response_halves = {};

// messages:

// (hello, whoami) -> 
// (get, key) -> val
// (set, key, val) -> ok

var keep_client = function(request,response) {
    var query = url.parse(request.url,true).query;
    if (query.i_am && query.callback) {
        console.log('keeping ', query.i_am, query.callback);
        clients[query.i_am] = { response:response, responder:make_responder(request,response), callback:query.callback };
        // console.log(" clients is now ", und(clients).keys().map(function(x) { return [ x, clients[x].callback ]; }));
        return true;
    } 
    return false;
};
var make_responder = function(request, response) {
    var query = url.parse(request.url,true).query;
    var id = query.i_am;
    var callback = query.callback;
    return (function(data, code) {
                delete clients[id];
                var response_str = (typeof(data) == 'object' ? JSON.stringify(data) : data);
                if (callback) {
                    // jsonp
                    response_str = callback+"("+response_str+")";
                }
                response.writeHead(code || 200, {"Content-Type": "text/plain"});
                response.write(response_str);
                response.end();
            });            
};
var blank_response = function(req,response) {   return make_responder(req,response)('', 200);  };

var handlers = {
    hello: function(req,res) {
        // keepers
        if (!keep_client(req,res)) {
            make_responder(req,res)('Please provide a name and a callback -- ',300);
        };
    },
    send_msg:function(req,res){
        var query = url.parse(req.url,true).query;
        // send the message to the destination
        if (clients[query.to] !== undefined) {
            clients[query.to].make_responder(query.message);
        }
    },
    _choose_nodes:function(key) {
        return und(clients).keys();
    },
    put:function(req,res){
        var query = url.parse(req.url,true).query;
        var data = query.data;
        var key = query.key;
        // choose someone to save
        var savers = this._choose_nodes(key);
        console.log("savers length ", savers.length, clients);
        seeds[key] = savers;                                 
        savers.map(function(k) { clients[k].responder({ msg: "put", key: key, data: data }); });
        make_responder(req,res)({status:200});
    },    
    get:function(req,res) {
        var query = url.parse(req.url,true).query;
        var data = query.data;
        var key = query.key;
        var asker = query.i_am;
        var get_request_id = query.get_request_id;
        if (seeds[key] !== undefined) {
            console.log(" __seeds has  ", key);
            // fabricate a new id to use to query all the remote nodes
            var remote_response_id =  new Date().valueOf();
            response_halves[remote_response_id] = function(data) {
                make_responder(req,res)({value:data});
            };
            var actives = seeds[key].filter(function(c_id) { return clients[c_id]; });
            console.log(" got active clients ", seeds[key].length, " - actives: ", actives.length);
            actives.map(function(c) {
                            console.log("sending off a request for ", key, remote_response_id, c);
                            clients[c].responder({msg: "get",  key:key, id:remote_response_id });
                        });            
        } else {
            // not found
            make_responder(req,res)({status:404, message:"key not found in tracker"}, 404);
        }
        // do not reply because we'll reply later -- 
     },
    get_response:function(req,res) {
        // second half of a get request, someone coming back with an id respon
        var query = url.parse(req.url,true).query;
        var id = query.id;
        console.log(">>get response ", query, id, query.data);
        if (query.id && response_halves[id]) {
            response_halves[id](query.data);
        }
        make_responder(req,res)({status:200});        
    }
};

exports.start = function() {
    var app = http.createServer(function(req, res) {
                                    var query = url.parse(req.url,true).query;
                                    console.log(" INCOMING >> ", query.msg);
                                    if (handlers[query.msg] == undefined) {
                                        return make_responder(req,res)("Dont know that command " + query.msg, 400);
                                    }
                                    handlers[query.msg](req,res);
                                }).listen(8888);    
};

