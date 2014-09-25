/**
 * _default: {
    'id': 'slider', //string|elementNode 幻灯容器的id或者该节点对象
    'begin': 0, //Number 默认从第几个幻灯开始播放，从0开始
    'auto': true, //bool 是否自动播放
    'speed':600, //Number 动画效果持续时间,单位是毫秒
    'timeout':5000, //Number 幻灯播放间隔时间,单位毫秒
    'align':'center', //string left|center|right 对齐方向（fixWidth=true情况下无效），靠左对齐（ipad版appStore上截图展现方式）、居中对齐（iphone版appStore上截图展现方式）、靠右对齐
    'fixWidth':true, //bool 默认会将每个幻灯宽度强制固定为容器的宽度,即每次只能看到一张幻灯；false的情况参见下方第一个例子
    'mouseWheel':false, //bool 是否支持鼠标滚轮
    'mouseDrag':true, //bool 是否支持鼠标拖拽切换
    'before':new Function(), //Function 幻灯切换前, before(newIndex, oldSlide)
    'after':new Function() //Function 幻灯切换后, after(newIndex, newSlide)
}

 var slider=new TouchSlider();
 slider.pause();//暂停播放
 slider.play();//开始播放
 slider.prev();//上一张
 slider.next();//下一张
 slider.go();//跳转到第几张
 slider.stop();//停止播放（暂停并回到第一张）
 slider.append(newLi);//末尾添加一个幻灯项，参考下边第二个幻灯示例
 slider.prepend(newLi);//开头添加一个幻灯项
 slider.remove(index);//删除第index个幻灯，slider.remove(1)
 slider.insertBefore(newLi,index);//在第index幻灯前插入一个幻灯项
 */


(function (window, undefined) {

    'use strict';

    //是否支持touch判断
    var hasTouch = ('createTouch' in document) || ('ontouchstart' in window),
        testStyle = document.createElement('div').style,
        testVendor = (function () {
            var cases = {
                'OTransform': ['-o-', 'otransitionend'],
                'WebkitTransform': ['-webkit-', 'webkitTransitionEnd'],
                'MozTransform': ['-moz-', 'transitionend'],
                'msTransform': ['-ms-', 'MSTransitionEnd'],
                'transform': ['', 'transitionend']
            }, prop;
            for (prop in cases) {
                if (prop in testStyle)return cases[prop];
            }
            return false;
        })(),
        sg = [['width', 'left', 'right'], ['height', 'top', 'bottom']],
        cssVendor = testVendor && testVendor[0],
        toCase = function (str) {
            return (str + '').replace(/^-ms-/, 'ms-').replace(/-([a-z]|[0-9])/ig, function (all, letter) {
                return (letter + '').toUpperCase();
            });
        },
        testCSS = function (prop) {
            var _prop = toCase(cssVendor + prop);
            return (prop in testStyle) && prop || (_prop in testStyle) && _prop;
        },
        parseArgs = function (arg, dft) {
            for (var key in dft) {
                if (typeof arg[key] == 'undefined') {
                    arg[key] = dft[key];
                }
            }
            return arg;
        },
        children = function (elem) {
            var children = elem.children || elem.childNodes,
                _ret = [], i = 0;
            for (; i < children.length; i++) {
                if (children[i].nodeType === 1) {
                    _ret.push(children[i]);
                }
            }
            return _ret;
        },
        each = function (arr, func) {
            var i = 0, j = arr.length;
            for (; i < j; i++) {
                if (func.call(arr[i], i, arr[i]) === false) {
                    break;
                }
            }
        },
        returnFalse = function (evt) {
            evt = TouchSlider.fn.eventHook(evt);
            evt.preventDefault();
        },
        transitionend = testVendor[1] || '',

    //构造器
        TouchSlider = function (id, cfg) {
            if (!(this instanceof TouchSlider)) {
                return new TouchSlider(id, cfg);
            }

            if (typeof id != 'string' && !id.nodeType) {
                cfg = id;
                id = cfg.id;
            }
            if (!id.nodeType) {
                id = document.getElementById(id);
            }
            this.cfg = parseArgs(cfg || {}, this._default);
            this.element = id;
            if (this.element) {
                this.container = this.element.parentNode || document.body;
                this.setup();
            }
        };

    TouchSlider.fn = TouchSlider.prototype = {
        version: '1.3.1',
        //默认配置
        _default: {

            'id': 'slider', //幻灯容器的id
            'begin': 0,
            'auto': true, //是否自动开始，负数表示非自动开始，0,1,2,3....表示自动开始以及从第几个开始
            'speed': 600, //动画效果持续时间 ms
            'timeout': 5000,//幻灯间隔时间 ms,
            'direction': 'left', //left right up down
            'align': 'center',
            'fixWidth': true,
            'mouseDrag': true,
            'before': function () {
            },
            'after': function () {
            },
            'continuous': true//是否连续
        },
        //设置OR获取节点样式
        css: function (elem, css) {
            if (typeof css == 'string') {
                var style = document.defaultView && document.defaultView.getComputedStyle && getComputedStyle(elem, null) || elem.currentStyle || elem.style || {};
                return style[toCase(css)];
            } else {
                var prop,
                    propFix;
                for (prop in css) {
                    if (prop == 'float') {
                        propFix = ('cssFloat' in testStyle) ? 'cssFloat' : 'styleFloat';
                    } else {
                        propFix = toCase(prop);
                    }
                    elem.style[propFix] = css[prop];
                }
            }
        },
        //绑定事件
        addListener: function (e, n, o, u) {
            if (e.addEventListener) {
                e.addEventListener(n, o, u);
                return true;
            } else if (e.attachEvent) {
                e.attachEvent('on' + n, o);
                return true;
            }
            return false;
        },
        removeListener: function (e, n, o, u) {
            if (e.addEventListener) {
                e.removeEventListener(n, o, u);
                return true;
            } else if (e.attachEvent) {
                e.detachEvent('on' + n, o);
                return true;
            }
            return false;
        },
        eventHook: function (origEvt) {
            var evt = {},
                props = 'changedTouches touches scale target view which clientX clientY fromElement offsetX offsetY pageX pageY toElement'.split(' ');
            origEvt = origEvt || window.event;
            each(props, function () {
                evt[this] = origEvt[this];
            });
            evt.target = origEvt.target || origEvt.srcElement || document;
            if (evt.target.nodeType === 3) {
                evt.target = evt.target.parentNode;
            }
            evt.preventDefault = function () {
                origEvt.preventDefault && origEvt.preventDefault();
                evt.returnValue = origEvt.returnValue = false;
            };
            evt.stopPropagation = function () {
                origEvt.stopPropagation && origEvt.stopPropagation();
                evt.cancelBubble = origEvt.cancelBubble = true;
            };
            if (hasTouch && evt.touches.length) {
                evt.pageX = evt.touches.item(0).pageX;
                evt.pageY = evt.touches.item(0).pageY;
            } else if (typeof origEvt.pageX == 'undefined') {
                var doc = document.documentElement,
                    body = document.body;
                evt.pageX = origEvt.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
                evt.pageY = origEvt.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc && doc.clientTop || body && body.clientTop || 0);
            }
            evt.origEvent = origEvt;
            return evt;
        },
        //修正函数作用环境
        bind: function (func, obj) {
            return function () {
                return func.apply(obj, arguments);
            };
        },
        //初始化
        setup: function () {
            var Touch = hasTouch || !this.cfg.mouseDrag,
                startEvent = Touch ? 'touchstart' : 'mousedown',
                moveEvent = Touch ? 'touchmove' : 'mousemove',
                endEvent = Touch ? 'touchend' : 'mouseup';

            this.slides = children(this.element);
            this.cacheSlides = children(this.element);
            this.length = this.slides.length;
            this.cfg.timeout = parseInt(this.cfg.timeout);
            this.cfg.speed = parseInt(this.cfg.speed);
            this.cfg.begin = parseInt(this.cfg.begin);
            this.cfg.auto = !!this.cfg.auto;
            this.cfg.timeout = Math.max(this.cfg.timeout, this.cfg.speed);
            this.touching = !!hasTouch;
            this.css3transition = !!testVendor;
            this.index = this.cfg.begin < 0 || this.cfg.begin >= this.length ? 0 : this.cfg.begin;

            if (this.length < 1)return false;

            this.direction = this.direction || 'left';
            this.vertical = 0;


            this.addListener(this.element, startEvent, this.bind(this._start, this), false);
            this.addListener(document, moveEvent, this.bind(this._move, this), false);
            this.addListener(document, endEvent, this.bind(this._end, this), false);
            this.addListener(document, 'touchcancel', this.bind(this._end, this), false);
            this.addListener(this.element, transitionend, this.bind(this.transitionend, this), false);

            this.addListener(window, 'resize', this.bind(function () {
                clearTimeout(this.resizeTimer);
                this.resizeTimer = setTimeout(this.bind(this.resize, this), 100);
            }, this), false);


            this.playing = this.cfg.auto;
            this.resize();
        },
        getSum: function (type, start, end) {
            var sum = 0, i = start,
                _type = toCase('-' + type);
            for (; i < end; i++) {
                sum += this['getOuter' + _type](this.slides[i]);
            }


            return sum;
        },
        getPos: function (type, index) {
            var _type = toCase('-' + type),
                sum = this.getSum(type, 0, index) + this['getOuter' + _type](this.element) / 2 - this['get' + _type](this.element) / 2;

            return -sum;

        },
        resize: function () {
            clearTimeout(this.aniTimer);
            var _this = this, css, type = sg[this.vertical][0], _type = toCase('-' + type),
                pst = this.css(this.container, 'position');
            this.css(this.container, {
                'overflow': 'hidden',
                'visibility': 'hidden',
                'listStyle': 'none',
                'position': pst == 'static' ? 'relative' : pst
            });
            this[type] = this['get' + _type](this.container);
            css = {float: this.vertical ? 'none' : 'left', display: 'block'};
            each(this.slides, function () {
                if (_this.cfg.fixWidth) {
                    css[type] = _this[type] - _this['margin' + _type](this) - _this['padding' + _type](this) - _this['border' + _type](this) + 'px';
                }
                _this.css(this, css);
            });
            this.total = this.getSum(type, 0, this.length);
            css = {position: 'relative', overflow: 'hidden'};
            css[cssVendor + 'transition-duration'] = '0ms';
            css[type] = this.total + 'px';
            css[sg[this.vertical][1]] = this.length ? this.getPos(type, this.index) + 'px' : 0;
            this.css(this.element, css);
            this.css(this.container, {'visibility': 'visible'});
            this.playing && this.play();
            return this;
        },

        go:function(index){
            var cur = this.cacheSlides[index];
            var curIndex = index;
            each(this.slides,function(i,type){
                if(cur===type){
                    curIndex = i;
                }
            });

            this.slide(curIndex);
        },


        slide: function (index, speed) {
            this.animateLock = true;
            var direction = sg[this.vertical][1],
                type = sg[this.vertical][0],
                transition = testCSS('transition'),
                nowPos = parseFloat(this.css(this.element, direction)) || 0,
                endPos, css = {}, change, size = this.getSum(type, index, index + 1);
            index = Math.min(Math.max(0, index), this.length - 1);
            speed = typeof speed == 'undefined' ? this.cfg.speed : parseInt(speed);
            endPos = this.getPos(type, index);
            change = endPos - nowPos; //变化量

            speed = Math.abs(change) < size ? Math.ceil(Math.abs(change) / size * speed) : speed;


            if (transition) {
                css[transition] = direction + ' ease ' + speed + 'ms';
                css[direction] = endPos + 'px';
                this.css(this.element, css);
            } else {
                var _this = this,
                    begin = 0, //动画开始时间
                    time = speed / 10,//动画持续时间
                    animate = function (t, b, c, d) { //缓动效果计算公式
                        return -c * ((t = t / d - 1) * t * t * t - 1) + b;
                    },
                    run = function () {
                        if (begin < time) {
                            begin++;
                            _this.element.style[direction] = Math.ceil(animate(begin, nowPos, change, time)) + 'px';
                            _this.aniTimer = setTimeout(run, 10);
                        } else {
                            _this.element.style[direction] = endPos + 'px';
                            _this.transitionend({propertyName: direction});
                        }
                    };
                clearTimeout(this.aniTimer);
                run();
            }
            var oldli = this.slides[this.index];
            this.index = index;
            this.cfg.before.call(this, index, oldli);
            return this;
        },
        play: function () {
            clearTimeout(this.timer);
            this.playing = true;
            this.timer = setTimeout(this.bind(function () {
                this.next();
            }, this), this.cfg.timeout);
            return this;
        },
        pause: function () {
            clearTimeout(this.timer);
            this.playing = false;
            return this;
        },
        stop: function () {
            this.pause();
            return this.slide(0);
        },
        prev: function (offset, sync, istouch) {
            if (this.animateLock) {
                return;
            }
            clearTimeout(this.timer);
            var index = this.index;
            var len = this.slides.length;
            var copyItem = null;
            var insertItem = null;
            if (!istouch && index === 0) {
                copyItem = this.slides[len - 1];
                insertItem = this.slides[0];
                this.element.removeChild(copyItem);
                this.element.insertBefore(copyItem, insertItem);
                this.refresh();
                this.element.style[this.cfg.direction] = -this.getOuterWidth(copyItem) + 'px';
            }


            offset = typeof offset == 'undefined' ? offset = 1 : offset % this.length;

            if (index === 0) {
            } else {
                index -= offset;
            }


            if (sync === false) {
                index = Math.max(index, 0);
            } else {
                index = index < 0 ? this.length + index : index;
            }


            return this.slide(index);
        },
        next: function (offset, sync, istouch) {
            if (this.animateLock) {
                return;
            }
            clearTimeout(this.timer);
            var index = this.index;
            var len = this.slides.length;
            var copyItem = null;
            var insertItem = null;
            if (!istouch && index === len - 1) {
                copyItem = this.slides[0];
                insertItem = this.slides[len - 1];
                this.element.removeChild(copyItem);
                this.element.appendChild(copyItem, insertItem);
                this.refresh();
                var tempPos = parseInt(this.element.style[this.cfg.direction], 10);
                this.element.style[this.cfg.direction] = (tempPos + this.getOuterWidth(copyItem)) + 'px';
            }

            if (typeof offset == 'undefined')offset = 1;
            if (index === len - 1) {
            } else {
                index += offset;
            }

            if (sync === false) {
                index = Math.min(index, this.length - 1);
            } else {
                index %= this.length;
            }
            return this.slide(index);
        },
        _start: function (evt) {
            evt = this.eventHook(evt);
            var name = evt.target.nodeName.toLowerCase();
            if (!this.touching && (name == 'a' || name == 'img'))evt.preventDefault();
            this.removeListener(this.element, 'click', returnFalse);
            this.startPos = [evt.pageX, evt.pageY];
            this.element.style[toCase(cssVendor + 'transition-duration')] = '0ms';
            this.startTime = +new Date();
            this._pos = parseFloat(this.css(this.element, sg[this.vertical][1])) || 0;
        },
        _move: function (evt) {
            if (!this.startPos || evt.scale && evt.scale !== 1)return;
            evt = this.eventHook(evt);
            this.stopPos = [evt.pageX, evt.pageY];
            var range, direction = sg[this.vertical][1],
                type = sg[this.vertical][0],
                offset = this.stopPos[this.vertical] - this.startPos[this.vertical];
            if (this.scrolling || typeof this.scrolling == 'undefined' && Math.abs(offset) >= Math.abs(this.stopPos[1 - this.vertical] - this.startPos[1 - this.vertical])) {
                evt.preventDefault();
                var len = this.slides.length;
                var copyItem = null;
                var insertItem = null;
                offset = offset / ((!this.index && offset > 0 || this.index == this.length - 1 && offset < 0) ? (Math.abs(offset) / this[type] + 1) : 1);
                if (!this.tempCreate && this.index === 0) {
                    this.tempCreate = true;
                    copyItem = this.slides[len - 1];
                    insertItem = this.slides[0];
                    this.element.removeChild(copyItem);
                    this.element.insertBefore(copyItem, insertItem);
                    this.refresh();
                    this._pos = -this.getOuterWidth(copyItem);
                } else if (!this.tempCreate && (this.index === len - 1)) {
                    this.tempCreate = true;
                    copyItem = this.slides[0];
                    insertItem = this.slides[len - 1];
                    this.element.removeChild(copyItem);
                    this.element.appendChild(copyItem, insertItem);
                    var tempPos = parseInt(this.element.style[this.cfg.direction], 10);
                    this.refresh();
                    this._pos = tempPos + this.getOuterWidth(copyItem);
                }

                this.element.style[direction] = this._pos + offset + 'px';


                if (window.getSelection != null) {
                    range = window.getSelection();
                    if (range.empty)range.empty();
                    else if (range.removeAllRanges)range.removeAllRanges();
                }
                if (offset && typeof this.scrolling == 'undefined') {
                    this.scrolling = true;//标记拖动（有效触摸）
                    clearTimeout(this.timer);//暂停幻灯
                    clearTimeout(this.aniTimer);//暂停动画
                }
            } else this.scrolling = false;
        },
        _end: function () {
            if (this.startPos) {
                if (this.scrolling) {
                    this.tempCreate = false;
                    var type = sg[this.vertical][0],
                    //direction=sg[this.vertical][1],
                        offset = this.stopPos[this.vertical] - this.startPos[this.vertical],
                        absOff = Math.abs(offset),
                        sub = absOff / offset,
                        myWidth, curPos, tarPos,
                        next = this.index, off = 0;
                    this.addListener(this.element, 'click', returnFalse);
                    if (absOff > 20) {//有效移动距离
                        curPos = parseFloat(this.css(this.element, sg[this.vertical][1]));
                        do {
                            if (next >= 0 && next < this.length) {
                                tarPos = this.getPos(type, next);
                                myWidth = this.getSum(type, next, next + 1);
                            } else {
                                next += sub;
                                break;
                            }
                        } while (Math.abs(tarPos - curPos) > myWidth / 2 && (next -= sub));
                        off = Math.abs(next - this.index);
                        if (!off && +new Date() - this.startTime < 250) {
                            off = 1;
                        }
                    }
                    offset > 0 ? this.prev(off, false, true) : this.next(off, false, true);

                    this.playing && this.play();
                }
                delete this._pos;
                delete this.stopPos;
                delete this.startPos;
                delete this.scrolling;
                delete this.startTime;
            }
        },
        transitionend: function (evt) {
            if (evt.propertyName == sg[this.vertical][1]) {
                this.cfg.after.call(this, this.index, this.slides[this.index]);
                this.playing && this.play();
            }
            this.animateLock = false;
        },
        refresh: function () {
            if (this.direction == null) {
                this.setup();
            } else {
                this.slides = children(this.element);
                this.length = this.slides.length;
                this.index = Math.max(Math.min(this.length - 1, this.index), 0);
                this.resize();
            }
        },
        append: function (elem) {
            this.element.appendChild(elem);
            this.refresh();
        },
        prepend: function (elem) {
            this.length ? this.insertBefore(elem, 0) : this.append(elem);
        },
        insertBefore: function (elem, index) {
            this.element.insertBefore(elem, this.slides[index]);
            if (this.index >= index) {
                this.index++;
            }
            this.refresh();
        },
        remove: function (index) {
            this.element.removeChild(this.slides[index]);
            if (this.index >= index) {
                this.index--;
            }
            this.refresh();
        }
    };

    each(['Width', 'Height'], function (i, type) {
        each(['margin', 'padding', 'border'], function (j, name) {
            TouchSlider.fn[name + type] = function (elem) {
                return (parseFloat(this.css(elem, name + '-' + sg[i][1] + (name == 'border' ? '-width' : ''))) || 0) + (parseFloat(this.css(elem, name + '-' + sg[i][2] + (name == 'border' ? '-width' : ''))) || 0);
            };
        });
        TouchSlider.fn['get' + type] = function (elem) {
            return elem['offset' + type] - this['padding' + type](elem) - this['border' + type](elem);
        };
        TouchSlider.fn['getOuter' + type] = function (elem) {
            return elem['offset' + type] + this['margin' + type](elem);
        };
    });

    window.TouchSlider = TouchSlider;
})(window);