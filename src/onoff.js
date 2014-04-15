(function(global, factory) {
	// AMD
	if (typeof define === 'function' && define.amd) {
		define([ 'jquery' ], factory);
	// CommonJS/Browserify
	} else if (typeof exports === 'object') {
		factory(require('jquery'));
	// Global
	} else {
		factory(global.jQuery);
	}
}(this, function($) {
	'use strict';

	// Lift touch properties using fixHooks
	var touchHook = {
		props: [ 'clientX', 'clientY' ],
		/**
		 * Support: Android
		 * Android sets clientX/Y to 0 for any touch event
		 * Attach first touch's clientX/Y if not set correctly
		 */
		filter: function( event, originalEvent ) {
			var touch;
			if ( !originalEvent.clientX && originalEvent.touches && (touch = originalEvent.touches[0]) ) {
				event.clientX = touch.clientX;
				event.clientY = touch.clientY;
			}
			return event;
		}
	};
	$.each([ 'touchstart', 'touchmove', 'touchend' ], function( i, name ) {
		$.event.fixHooks[ name ] = touchHook;
	});

	var count = 1;
	var slice = Array.prototype.slice;
	// Support pointer events if available
	var pointerEvents = !!window.PointerEvent;

	var ua = navigator.userAgent;
	var isTablet = ua.indexOf('iPhone') != -1
					|| ua.indexOf('iPod') != -1
					|| ua.indexOf('iPad') != -1
					|| ua.indexOf('Android') != -1;

	/**
	 * Create an OnOff object for a given element
	 * @constructor
	 * @param {Element} elem - Element to use pan and zoom
	 * @param {Object} [options] - An object literal containing options
	 *  to override default options (See OnOff.defaults)
	 */
	function OnOff(elem, options) {

		// Allow instantiation without `new` keyword
		if (!(this instanceof OnOff)) {
			return new OnOff(elem, options);
		}

		// Sanity checks
		if (elem.nodeName.toLowerCase() !== 'input' || elem.type !== 'checkbox') {
			return $.error('OnOff should be called on checkboxes');
		}

		// Don't remake
		var d = $.data(elem, OnOff.datakey);
		if (d) {
			return d;
		}

		// Extend default with given object literal
		// Each instance gets its own options
		this.options = options = $.extend({}, OnOff.defaults, options);
		this.elem = elem;
		this.$elem = $(elem).addClass(options.className);
		this.$doc = $(elem.ownerDocument || document);

		// Add guid to event namespace
		options.namespace += $.guid++;

		// Add an ID if none has been added
		if (!elem.id) {
			elem.id = 'onoffswitch' + count++;
		}

		// Enable
		this.enable();

		// Save the instance
		$.data(elem, OnOff.datakey, this);
	}

	OnOff.datakey = '_onoff';

	OnOff.defaults = {
		// The event namespace
		// Should always be non-empty
		// Used to bind jQuery events without collisions
		namespace: '.onoff',

		// The class added to the checkbox (see the CSS file)
		className: 'onoffswitch-checkbox'
	};

	OnOff.prototype = {
		constructor: OnOff,

		/**
		 * @returns {Panzoom} Returns the instance
		 */
		instance: function() {
			return this;
		},

		/**
		 * Wrap the checkbox and add the label element
		 */
		wrap: function() {
			var elem = this.elem;
			var $elem = this.$elem;


			// Get or create elem wrapper
			var $con = $elem.parent('.onoffswitch');
			if (!$con.length) {
				$elem.wrap('<div class="onoffswitch"></div>');
				$con = $elem.parent();
			}
			this.$con = $con;

			// Get or create label
			var $label = $elem.next('label[for="' + elem.id + '"]');
			if (!$label.length) {
				$label = $('<label/>')
					.attr('for', elem.id)
					.insertAfter(elem);
			}
			this.$label = $label.addClass('onoffswitch-label');

			// Inner
			var $inner = $label.find('.onoffswitch-inner');
			if (!$inner.length) {
				$inner = $('<div/>')
					.addClass('onoffswitch-inner')
					.prependTo($label);
			}
			this.$inner = $inner;

			// Switch
			var $switch = $label.find('.onoffswitch-switch');
			if (!$switch.length) {
				$switch = $('<div/>')
					.addClass('onoffswitch-switch')
					.appendTo($label);
			}
			this.$switch = $switch;
		},

		/**
		 * Handles the move event on the switch
		 */
		_handleMove: function(e) {
			if (this.disabled) return;
			this.moved = true;
			this.lastX = e.clientX;
			var right = Math.max(Math.min(this.startX - this.lastX, this.maxRight), 0);
			this.$switch.css('right', right);
			this.$inner.css('marginLeft', -(right / this.maxRight) * 100 + '%');
		},

		/**
		 * Bind the move and end events to the document
		 */
		_startMove: function(e) {
			// Prevent default to avoid touch event collision
			e.preventDefault();

			var moveType, endType;
			if (pointerEvents) {
				moveType = 'pointermove';
				endType = 'pointerup';
			} else if (e.type === 'touchstart') {
				moveType = 'touchmove';
				endType = 'touchend';
			} else {
				if(isTablet) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				moveType = 'mousemove';
				endType = 'mouseup';
			}


			var elem = this.elem;
			var ns = this.options.namespace;
			// Disable transitions
			var $handle = this.$switch;
			var handle = $handle[0];
			var $t = this.$inner.add($handle).css('transition', 'none');



			// Starting values
			this.maxRight = this.$con.width() - $handle.width() -
				$.css(handle, 'margin-left', true) -
				$.css(handle, 'margin-right', true) -
				$.css(handle, 'border-left-width', true) -
				$.css(handle, 'border-right-width', true);


			var startChecked = elem.checked;
			this.moved = false;
			this.startX = e.clientX + (startChecked ? 0 : this.maxRight);

			// Bind document events
			var self = this;
			var $doc = this.$doc
				.on(moveType + ns, $.proxy(this._handleMove, this))
				.on(endType + ns, function(e) {
					// Reenable transition
					$t.css('transition', '');
					$doc.off(ns);
					setTimeout(function() {
						// If there was a move
						// ensure the proper checked value
						if (self.moved) {
							var checked = self.lastX > (self.startX - self.maxRight / 2);
//							elem.checked = self.lastX > (self.startX - self.maxRight / 2);

							if(checked != elem.checked){
								elem.checked = checked;
								$(elem).trigger('change');
							}
						}else if(isTablet){
							self.triggeredClick = true;
							var evt = document.createEvent('MouseEvents');
						    evt.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0,
						        false, false, true, false, 0, null);
							self.$label[0].dispatchEvent(evt);
						}

						// Normalize CSS and animate
						self.$switch.css('right', '');
						self.$inner.css('marginLeft', '');
					});
				});
		},

		/**
		 * Binds all necessary events
		 */
		_bind: function() {
			this._unbind();
			var type = pointerEvents ? 'pointerdown' : 'mousedown touchstart';
			var self = this;

			this.$switch.unbind(type).on(type, $.proxy(this._startMove, this));
			if(!isTablet){
				this.$switch.unbind('click').bind('click', function(e){
					if (self.disabled) return;
					if(self.moved){
						e.preventDefault();
						return false;
					}
				});
			}else{
				this.$label.unbind('click touchstart').bind('click', function(e){
					if(self.triggeredClick && !e.shiftKey){
						e.preventDefault();
						return false;
					}
				}).bind('touchstart', function(){
					self.triggeredClick = false;
				});
			}

			this.$elem.unbind('change').bind('change', function(){
				$(this).parents('.switch').trigger('switch-change', {'el': $(this), 'value': $(this).is(':checked')});
			});
		},

		/**
		 * Enable or re-enable the onoff instance
		 */
		enable: function() {
			// Ensures the correct HTML before binding
			this.wrap();
			this._bind();
			this.disabled = false;
			this.$elem.prop('disabled', false);
			this.$label.removeClass('deactivate');
		},

		/**
		 * Unbind all events
		 */
		_unbind: function() {
			var ns = this.options.namespace;
			this.$doc.off(ns);
			this.$switch.off(ns);
		},

		/**
		 * Disable onoff
		 * Removes all added HTML
		 */
		disable: function() {
			this.disabled = true;
			this.$elem.prop('disabled', true);
			this._unbind();
			this.$label.addClass('deactivate');
		},

		/**
		 * Removes all onoffswitch HTML and leaves the checkbox
		 * Also disables this instance
		 */
		unwrap: function() {
			// Destroys this OnOff
			this.disable();
			this.$label.remove();
			this.$elem.unwrap();
		},

		/**
		 * @returns {Boolean} Returns whether the current onoff instance is disabled
		 */
		isDisabled: function() {
			return this.disabled;
		},

		/**
		 * Destroy the onoff instance
		 */
		destroy: function() {
			this.disable();
			$.removeData(this.elem, OnOff.datakey);
		},

		/**
		 * Get/set option on an existing instance
		 * @returns {Array|undefined} If getting, returns an array of
		 *  all values on each instance for a given key. If setting,
		 *  continue chaining by returning undefined.
		 */
		option: function(key, value) {
			var newOpts;
			var options = this.options;
			if (!key) {
				// Avoids returning direct reference
				return $.extend({}, options);
			}

			if (typeof key === 'string') {
				if (arguments.length === 1) {
					return options[ key ] !== undefined ?
						options[ key ] :
						null;
				}
				newOpts = {};
				newOpts[ key ] = value;
			} else {
				newOpts = key;
			}

			// Set options
			$.each(newOpts, $.proxy(function(k, val) {
				switch(k) {
					case 'namespace':
						this._unbind();
						break;
					case 'className':
						this.$elem.removeClass(options.className);
				}
				options[ k ] = val;
				switch(k) {
					case 'namespace':
						this._bind();
						break;
					case 'className':
						this.$elem.addClass(val);
				}
			}, this));
		}
	};

	/**
	 * Extend jQuery
	 * @param {Object|String} options - The name of a method to call
	 *  on the prototype or an object literal of options
	 * @returns {jQuery|Mixed} jQuery instance for regular chaining or
	 *  the return value(s) of a onoff method call
	 */
	$.fn.onoff = function(options) {
		var instance, args, m, ret;

		// Call methods widget-style
		if (typeof options === 'string') {
			ret = [];
			args = slice.call(arguments, 1);
			this.each(function() {
				instance = $.data(this, OnOff.datakey);

				if (!instance) {
					ret.push(undefined);

				// Ignore methods beginning with `_`
				} else if (options.charAt(0) !== '_' &&
					typeof (m = instance[ options ]) === 'function' &&
					// If nothing is returned, do not add to return values
					(m = m.apply(instance, args)) !== undefined) {

					ret.push(m);
				}
			});

			// Return an array of values for the jQuery instances
			// Or the value itself if there is only one
			// Or keep chaining
			return ret.length ?
				(ret.length === 1 ? ret[0] : ret) :
				this;
		}

		return this.each(function() { new OnOff(this, options); });
	};
	return ($.OnOff = OnOff);
}));

