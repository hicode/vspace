/**
 * vspace
 * A non-blocking sequence loading modularize loader with namespace
 *
 * @version 1.0
 * @author visvoy@gmail.com
 * @link https://github.com/visvoy/vspace
 * @license free to use, free to change, anything you can do
 */
(function(window) {
var 
    // script name prefix of this file
    myName = 'vspace',
    
    // DOM document
    document = window.document,
    
    // current using sequence under loading
    waitQueue = {},
    
    // loaded using storage
    usedSpace = {},
    
    // tell status of sequence daemon
    daemonIsRunning = false;
    
    // callback functions after sequence loading ready
    callback = [],
    
    // default config
    config = {
        // load script under sequence?
        sequence: true,
        
        // sequence daemon monitor frequency (ms)
        frequency: 50,
        
        // local script base path
        basepath: ''
    };

// mark log message
function writeLog(msg) {
    window.console && window.console.log(msg);
}

// clean space, tab for both left side and right side of the given string
function trim(text) {
	return (text || "").replace(/^\s+|\s+$/g, "");
}

// push a using script into waiting queue
function pushUsing(ns) {
    if (typeof usedSpace[ns] == 'undefined' && typeof waitQueue[ns] == 'undefined') {
        waitQueue[ns] = 0;
    }
}

// check if the namespace is a local script or cross size script
function isCrossDomain(ns) {
    var nsDomain = ns.indexOf('://');
    if (nsDomain < 0) {
        return false;
    }
    
    var rootPos = ns.indexOf('/', nsDomain + 3);
    if (rootPos > 0) {
        nsDomain = ns.substring(0, rootPos);
    }
    nsDomain = location.href.toLowerCase().indexOf(nsDomain.toLowerCase());
    if (nsDomain > -1 && nsDomain < 6) {
        return false;
    }
    
    return true;
}

// run the using sequence daemon
function runSequenceDaemon() {
    if ( ! daemonIsRunning) {
        // console.log('run daemon');
        daemonIsRunning = true;
        sequenceDaemon();
    }
}

// using sequence daemon workflow
function sequenceDaemon() {
    var ns, tmp, haveWait = false;
    
    // load all local domain first
    for (ns in waitQueue) {
        if (0 === waitQueue[ns] && ! isCrossDomain(ns)) {
            // set status "loading"
            waitQueue[ns] = 2;
            sameDomainUsing(ns);
        }
    }

    // sequence run
    for (ns in waitQueue) {
        // run local using
        if (isNaN(waitQueue[ns])) {
            // console.log('ajax evaled: '+ns);
            usedSpace[ns] = 1;
            tmp = waitQueue[ns];
            delete waitQueue[ns];
            eval.call(window, tmp);
            continue;
        }
        
        // under sequenced loading and current using is running
        if (2 === waitQueue[ns] && config.sequence) {
            // console.log('sequence on')
            return window.setTimeout(sequenceDaemon, config.frequency);
        }
        
        // any using not yet start?
        if (0 === waitQueue[ns]) {
            // set status "loading"
            waitQueue[ns] = 2;
            isCrossDomain(ns) ? crossDomainUsing(ns) : sameDomainUsing(ns);
            
            if (config.sequence) {
                // console.log('sequence on')
                return window.setTimeout(sequenceDaemon, config.frequency);
            }
        }

        // move error using to used stack
        if (1 === waitQueue[ns] || waitQueue[ns] < 0) {
            usedSpace[ns] = waitQueue[ns];
            delete waitQueue[ns];
        }
    }

    // check if any unfinished using, 
    // otherwise the daemon have to wait until all using item is loaded
    haveWait = false;
    for (ns in waitQueue) {
        haveWait = true;
        break;
    }
    if (haveWait) {
        // console.log('daemon called', waitQueue);
        return window.setTimeout(sequenceDaemon, config.frequency);
    }
    
    // sequence complete, run callback
    daemonIsRunning = false;
    // console.log('stop daemon, callback');
    while (ns = callback.pop()) {
        ns.call(window);
    }
}

// get an AJAX request object
function makeAjaxRequest() {
    try {
        return new window.XMLHttpRequest();
    } catch (ex) {}
    // try {
    //     return new window.ActiveXObject("Msxml2.XMLHTTP");
    // } catch (ex) {}
    try {
        return new window.ActiveXObject("Microsoft.XMLHTTP");
    } catch (ex) {}
    throw new Exception('cant use ajax');
}

// loading local script
function sameDomainUsing(ns) {
    // console.log('local domain: ' + ns)
    var url, req = makeAjaxRequest();
    req.onreadystatechange = function() {
		if (req.readyState != 4) {
			return;
		}
        // console.log('ajax loaded: '+ns);
		if (200 == req.status) {
            waitQueue[ns] = (typeof req.responseText == 'string' ? req.responseText : -1);
		} else {
            waitQueue[ns] = -req.status;
            var logText = "using failed: " + ns + " got status: " + req.status;
            if (typeof req.responseText == 'string') {
                logText += " and detail:\n" + req.responseText;
            }
            writeLog(logText);
        }
    }

    url = (ns.substr(-3) == '.js' ? ns : ns + '.js');
    if (url.indexOf("/") < 0 && config.basepath) {
        url = config.basepath + url;
    }
	req.open("GET", url);
	req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
	req.send();
}

// load cross site script
function crossDomainUsing(ns) {
    // console.log('cross domain: ' + ns)
    var js = document.createElement('script');
    js.onload = js.onreadystatechange = function() {
        if ( ! this.readyState || 'loaded' == this.readyState || 'complete' == this.readyState) {
            // console.log('cross domain loaded: '+ns);
            waitQueue[ns] = 1;
            // js.onload = js.onreadystatechange = null;
        }
    };
    js.id = '_vspace_' + Math.random();
    js.src = ns;
    js.type = 'text/javascript';
    // js.defer = true;
    document.body.appendChild(js);
}

// apply namespace feature
window.namespace = function(ns) {
    if (!ns || !ns.length) {
        return null;
    }

    var levels = ns.split("."),
        nsobj = window,
        i;

    for (i = (levels[0] == "window") ? 1 : 0; i < levels.length; ++i) {
        nsobj[levels[i]] = nsobj[levels[i]] || {}; 
        nsobj = nsobj[levels[i]]; 
    } 

    return nsobj; 
};

// using any scripts
window.using = function() {
    for (var i = 0; i < arguments.length; i++) {
        // console.log('using '+arguments[i]);
        pushUsing(trim(arguments[i]));
    }
    
    runSequenceDaemon();
    return window.using;
};

// attach using sequence all complete callback event
window.using.ready = function(callbackFunc) {
    callback.push(callbackFunc);
    runSequenceDaemon();
};

// configuration
window.using.config = function(key, value) {
    if (typeof key == 'undefined') {
        return config;
    }
    if (typeof key != 'object') {
        var k = {};
        k[key] = value;
        key = k;
    }
    for (var k in key) {
        if (typeof key[k] == 'string') {
            if ('true' == key[k].toLowerCase()) {
                key[k] = true;
            } else if ('false' == key[k].toLowerCase()) {
                key[k] = false;
            }
        }
        config[k] = key[k];
    }
};

// vspace initialize
var r, k, scripts = document.getElementsByTagName('script');
for (k in scripts) {
    if (scripts[k].src && scripts[k].src.indexOf(myName) > -1) {
        for (r in config) {
            if (scripts[k].getAttribute(r)) {
                using.config(r, scripts[k].getAttribute(r));
            }
        }
        
        if (r = scripts[k].getAttribute('run')) {
            r = (r.indexOf(',') < 1 ? [r] : r.split(','));
            using.apply(window, r);
        }
        
        break;
    }
}
delete r;
delete k;
delete scripts;

})(window);