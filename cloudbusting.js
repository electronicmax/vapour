
/* client for the Cloudbust Overlay Network */
function Cloudbust(tracker) {
    this.tracker = tracker;
    this.storage = localStorage;
    this.generate_id();
    this.listen();
    this.get_response_wait = {};
};

Cloudbust.prototype = {
    generate_id:function() {
        if (this.storage.__my_id == undefined) {
            this.storage.__my_id = 'storage-node-'+(new Date()).valueOf();
        }
        this.my_id = this.storage.__my_id;
    },
    listen:function() {
        var this_ = this;
        this._connect().
            success(function(message) { this_._handleMessage(message); }).
            error(function(e) {
                      if (e.statusText !== 'abort') {
                          console.error("listen error >> ", e.statusText, e);
                          setTimeout(function() { this_.listen(); }, 1000);
                      }
                      // this_.listen();
                  });
    },
    _handleMessage:function(message)     {
        console.log(" got message ", message, typeof(message));
        if (this['_handle_' + message.msg] !== undefined) {
            this['_handle_' + message.msg](message);
        } else {
            console.error("Unknown message ", message.msg);
            this.listen();
        }
    },
    _connect:function(data) {
        if (data === undefined) {   data = { msg: "hello", i_am: this.my_id };   }
        if (this._ !== undefined) {
            console.log(" aborting the last one >> ");
            this._.abort();
            delete this._;
        }
        // console.log(" _ connect ", this.tracker, data.msg, data.key, data.val, data);
        data.i_am = this.my_id;
        this._ = $.getJSON(this.tracker, data);
        return this._;
    },
    _handle_get:function(message) {
        // console.log("_handle_get >>>>> ", message);        
        var this_ = this;
        var key = message.key;
        if (this.storage[key] !== undefined) {
            // console.log("_handle_get responding with  ", key, this.storage[key]);        
            this._connect({ id: message.id, msg: "get_response", data: this.storage[key] }).
                success(function(message) {
                            // console.log("_handle_get response from response  ", message); 
                            this_._handleMessage(message);
                        }).
                fail(function(f) {
                         console.error("_getresponse posted fail ", f);
                         this_.listen();
                     });
        }                      
    },
    _handle_put:function(message) {
        console.log("_handle_put ", message);
        var key = message.key;
        var val = message.data;
        this.storage[key] = val;
        this.listen();        
    },
    _handle_get_response:function(message) {
        if (this.get_response_wait[message.get_request_id]) {
            // console.log("_handle_get_response win for id id ",  message.get_request_id);
            this.get_response_wait[message.get_request_id](message)
        } else {
            console.log("_handle_get_response error > none for id ",  message.get_request_id);
        }
        this._connect();
    },
    get:function(key) {
        var d = new $.Deferred();
        var this_ = this;
        var get_request_id = "get-"+key+"-"+(new Date()).valueOf();
        this_.get_response_wait[get_request_id] =
            function(message) {
                delete this_.get_response_wait[get_request_id];
                d.resolve(message.value);
            };        
        this._connect({ msg:"get", key: key, get_request_id:get_request_id }).success(function(message) {  this_._handleMessage(message); });
        return d.promise();
    },
    put:function(key,value) {
        var d = new $.Deferred();
        var this_ = this;
        this._connect({ msg:"put", key: key, data: value }).
            success( function(message) {
                         d.resolve();
                         this_._handleMessage(message);
                     }).
            error(function(error) {
                     console.error("puterror() ", error); 
                  });
        return d.promise();
    },
    clear:function() {
        // only clears local storage 
        this.storage.clear();
        this.generate_id();
    }
};