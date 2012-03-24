/* client for the Vapour Overlay Network */
function Vapour(tracker) {
    this.tracker = tracker;
    this.storage = localStorage;
    this.generate_id();
    this.listen();
    this.get_response_wait = {};
};

Vapour.prototype = {
    generate_id:function() {
        if (this.storage.__my_id == undefined) {
            this.storage.__my_id = 'storage-node-'+(new Date()).valueOf();
        }
        this.my_id = this.storage.__my_id;
    },
    listen:function() {
        var this_ = this;
        if (this._ !== undefined) {
            console.log(this._.state());
        }
        if (this._ !== undefined && this._.state() == 'pending') {
            console.log("pending -- so we're okay ", this._);
            return;
        } else if  (this._ !== undefined) {
            console.log("non-pending -- so deleting and trying again ", this._);
            // this._.abort();
            delete this._;
        }        
        this._ = this._connect().
            success(function(message) {
                        this_._handleMessage(message);
                        setTimeout(function() { this_.listen(); }, 10);
                    }).
            error(function(e) {
                      if (e.statusText !== 'abort') {
                          console.error("listen error >> ", e.statusText, e);
                          setTimeout(function() { this_.listen(); }, 1000);
                      }
                  });
        return this._;
    },
    _handleMessage:function(message)     {
        console.log(" got message ", message, typeof(message));
        if (this['_handle_' + message.msg] !== undefined) {
            this['_handle_' + message.msg](message);
        } else {
            console.error("Unknown message ", message.msg);
        }
    },
    _connect:function(data) {
        if (data === undefined) {   data = { msg: "hello", i_am: this.my_id };   }
        // console.log(" _ connect ", this.tracker, data.msg, data.key, data.val, data);
        data.i_am = this.my_id;
        return $.getJSON(this.tracker, data);
    },
    _handle_get:function(message) {
        // console.log("_handle_get >>>>> ", message);        
        var this_ = this;
        var key = message.key;
        if (this.storage[key] !== undefined) {
            // console.log("_handle_get responding with  ", key, this.storage[key]);        
            this._connect({ id: message.id, msg: "get_response", data: this.storage[key] }).
                success(function(message) {
                            // we're happy ---- do nothing.
                            // console.log("_handle_get - message back > ", message);
                        }).
                fail(function(f) {
                         console.error("_getresponse posted fail ", f);
                     });
        }                      
    },
    _handle_put:function(message) {
        console.log("_handle_put ", message);
        var key = message.key;
        var val = message.data;
        this.storage[key] = val;
    },
    _handle_get_response:function(message) {
        if (this.get_response_wait[message.get_request_id]) {
            this.get_response_wait[message.get_request_id](message);
        } else { console.log("_handle_get_response error > none for id ",  message.get_request_id);  }
    },
    get:function(key) {
        var d = new $.Deferred();
        var this_ = this;
        this._connect({ msg:"get", key: key }).success(
            function(message) {
                d.resolve(message.value);
            }
        );        
        return d.promise();
    },
    put:function(key,value) {
        var d = new $.Deferred();
        var this_ = this;
        this._connect({ msg:"put", key: key, data: value }).
            success( function(message) {
                         console.log("_put response > ", message);
                         d.resolve();
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