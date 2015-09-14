
var
    fs = require("fs"),
    iconv; // loaded if necessary

const
    BUFFER_LENGTH = 1024;

const
    xsStart = 0,
    xsEatSpaces = 1,
    xsElement = 2,
    xsElementName = 3,
    xsAttributes = 4,
    xsAttributeName = 5,
    xsEqual = 6,
    xsAttributeValue = 7,
    xsCloseEmptyElement = 8,
    xsTryCloseElement = 9,
    xsCloseElementName = 10,
    xsChildNodes = 11,
    xsElementString = 12,
    xsElementComment = 13,
    xsCloseElementComment = 14,
    xsDoctype = 15,
    xsElementPI = 16,
    xsElementDataPI = 17,
    xsCloseElementPI = 18,
    xsElementCDATA = 19,
    xsClodeElementCDATA = 20,
    xsEscape = 21,
    xsEscape_lt = 22,
    xsEscape_gt = 23,
    xsEscape_amp = 24,
    xsEscape_apos = 25,
    xsEscape_quot = 26,
    xsEscape_char = 27,
    xsEscape_char_num = 28,
    xsEscape_char_hex = 29,
    xsEnd = 30;

const
    xcElement = 0,
    xcComment = 1,
    xcString = 2,
    xcCdata = 3,
    xcProcessInst = 4;

const
    xtOpen = exports.xtOpen = 0,
    xtClose = exports.xtClose = 1,
    xtAttribute = exports.xtAttribute = 2,
    xtText = exports.xtText = 3,
    xtCData = exports.xtCData = 4,
    xtComment = exports.xtComment = 5;

const
    CHAR_TAB    = 9,
    CHAR_LF     = 10,
    CHAR_CR     = 13,
    CHAR_SP     = 32,
    CHAR_EXCL   = 33, // !
    CHAR_DBLQ   = 34, // "
    CHAR_SHRP   = 35, // #
    CHAR_AMPE   = 38, // &
    CHAR_SINQ   = 39, // '
    CHAR_MINU   = 45, // -
    CHAR_PT     = 46, // .
    CHAR_SLAH   = 47, // /
    CHAR_ZERO   = 48, // 0
    CHAR_NINE   = 57, // 9
    CHAR_COLO   = 58, // :
    CHAR_SCOL   = 59, // ;
    CHAR_LESS   = 60, // <
    CHAR_EQUA   = 61, // =
    CHAR_GREA   = 62, // >
    CHAR_QUES   = 63, // ?
    CHAR_A      = 65,
    CHAR_C      = 67,
    CHAR_D      = 68,
    CHAR_F      = 70,
    CHAR_T      = 84,
    CHAR_Z      = 90,
    CHAR_LEBR   = 91, // [
    CHAR_RIBR   = 93, // [
    CHAR_LL     = 95, // _
    CHAR_a      = 97,
    CHAR_f      = 102,
    CHAR_g      = 103,
    CHAR_l      = 108,
    CHAR_m      = 109,
    CHAR_o      = 111,
    CHAR_p      = 112,
    CHAR_q      = 113,
    CHAR_s      = 115,
    CHAR_t      = 116,
    CHAR_u      = 117,
    CHAR_x      = 120,
    CHAR_z      = 122,
    CHAR_HIGH   = 161;

const
    STR_ENCODING = 'encoding',
    STR_XML = 'xml';

function isSpace(v) {
    return (v == CHAR_TAB || v == CHAR_LF || v == CHAR_CR || v == CHAR_SP)
}

function isAlpha(v) {
    return (v >= CHAR_A && v <= CHAR_Z) ||
    (v >= CHAR_a && v <= CHAR_z) ||
    (v == CHAR_LL) || (v == CHAR_COLO) || (v >= CHAR_HIGH)
}

function isNum(v) {
    return (v >= CHAR_ZERO && v <= CHAR_NINE)
}

function isAlphaNum(v) {
    return (isAlpha(v) || isNum(v) || (v == CHAR_PT) || (v == CHAR_MINU))
}

function isHex(v) {
    return (v >= CHAR_A && v <= CHAR_F) ||
        (v >= CHAR_a && v <= CHAR_f) ||
        (v >= CHAR_ZERO && v <= CHAR_NINE)
}

function hexDigit(v) {
    if (v <= CHAR_NINE) {
        return v - CHAR_ZERO
    } else {
        return (v & 7) + 9
    }
}

// ------------------------------

const
   STRING_BUFFER_SIZE = 32;

function StringBuffer() {
    this.buffer = new Buffer(STRING_BUFFER_SIZE);
    this.pos = 0;
}

StringBuffer.prototype.append = function(value) {
    if (this.pos == this.buffer.length) {
        var buf = new Buffer(this.buffer.length * 2);
        this.buffer.copy(buf);
        this.buffer = buf;
    }
    this.buffer.writeUInt8(value, this.pos);
    this.pos++;
};

StringBuffer.prototype.appendBuffer = function(value) {
    if (value.length) {
        var len = this.buffer.length;
        while (len - this.pos < value.length) {
            len *= 2;
        }
        if (len != this.buffer.length) {
            var buf = new Buffer(len);
            this.buffer.copy(buf);
            this.buffer = buf;
        }
        value.copy(this.buffer, this.pos);
        this.pos += value.length;
    }
};

StringBuffer.prototype.toString = function(encoding) {
    if (!encoding) {
        return this.buffer.slice(0, this.pos).toString()
    }
    if (!iconv) {
        iconv = require("iconv-lite");
    }
    return iconv.decode(this.buffer.slice(0, this.pos), encoding);
};

StringBuffer.prototype.toBuffer = function() {
    var ret = new Buffer(this.pos);
    this.buffer.copy(ret);
    return ret;
};

// ------------------------------

function XMLParser() {
    this.stackUp();
    this.str = new StringBuffer();
    this.value = new StringBuffer();
    this.line = 0;
    this.col = 0;
}

XMLParser.prototype.stackUp = function() {
    var st = {};
    st.state = xsEatSpaces;
    st.savedstate = xsStart;
    st.prev = this.stack;
    if (st.prev) {
        st.prev.next = st;
    }
    this.stack = st;
};

XMLParser.prototype.stackDown = function() {
    if (this.stack) {
        this.stack = this.stack.prev;
        if (this.stack) {
            delete this.stack.next;
        }
    }
};

XMLParser.prototype.parseBuffer = function(buffer, len, event) {
    buffer = stripBom(buffer);
    len = buffer.length; 

    var i = 0;
    var c = buffer[i];
    while (true) {
        switch (this.stack.state) {
            case xsEatSpaces:
                if (!isSpace(c)) {
                    this.stack.state = this.stack.savedstate;
                    continue;
                }
                break;
            case xsStart:
                if (c == CHAR_LESS) {
                    this.stack.state = xsElement;
                    break;
                } else {
                    return false;
                }
            case xsElement:
               switch (c) {
                   case CHAR_QUES:
                       this.stack.savedstate = xsStart;
                       this.stack.state = xsEatSpaces;
                       this.stackUp();
                       this.str.pos = 0;
                       this.stack.state = xsElementPI;
                       this.stack.clazz = xcProcessInst;
                       break;
                   case CHAR_EXCL:
                       this.position = 0;
                       this.stack.savedstate = xsStart;
                       this.stack.state = xsElementComment;
                       this.stack.clazz = xcComment;
                       break;
                   default:
                       if (isAlpha(c)) {
                            this.str.pos = 0;
                            this.stack.state = xsElementName;
                            this.stack.clazz = xcElement;
                            continue;
                       } else {
                           return false;
                       }
               }
               break;
            case xsElementPI:
                if (isAlphaNum(c)) {
                    this.str.append(c);
                    break;
                } else {
                    this.stack.state = xsEatSpaces;
                    if (this.str == STR_XML) {
                        this.stack.savedstate = xsAttributes;
                    } else {
                        this.value.pos = 0;
                        this.stack.savedstate = xsElementDataPI;
                    }
                    continue;
                }
            case xsElementDataPI:
                if (c == CHAR_QUES) {
                    this.stack.state = xsCloseElementPI;
                } else {
                    this.value.append(c);
                }
                break;
            case xsCloseElementPI:
                if (c != CHAR_GREA) {
                    return false;
                }
                this.stackDown();
                break;
            case xsElementName:
                if (isAlphaNum(c)) {
                    this.str.append(c);
                } else {
                    this.stack.name = this.str.toBuffer();
                    if (!event(xtOpen, this.str.toString())) {
                        return false;
                    }
                    this.stack.state = xsEatSpaces;
                    this.stack.savedstate = xsAttributes;
                    continue;
                }
                break;
            case xsChildNodes:
                if (c == CHAR_LESS) {
                    this.stack.state = xsTryCloseElement;
                    break;
                } else {
                    this.value.pos = 0;
                    this.stack.state = xsElementString;
                    this.stack.clazz = xcString;
                    continue;
                }
            case xsCloseEmptyElement:
                if (c == CHAR_GREA) {
                    if (!event(xtClose)) {
                        return false;
                    }
                    if (!this.stack.prev) {
                        return true;
                    }
                    this.stack.state = xsEnd;
                    break;
                } else {
                    return false;
                }
            case xsTryCloseElement:
                switch (c) {
                    case CHAR_SLAH:
                        this.stack.state = xsCloseElementName;
                        this.position = 0;
                        this.str.pos = 0;
                        this.str.appendBuffer(this.stack.name);
                        break;
                    case CHAR_EXCL:
                        this.position = 0;
                        this.stack.state = xsElementComment;
                        this.stack.clazz = xcComment;
                        break;
                    case CHAR_QUES:
                        this.stack.state = xsChildNodes;
                        this.stackUp();
                        this.str.pos = 0;
                        this.stack.state = xsElementPI;
                        this.stack.clazz = xcProcessInst;
                        break;
                    default:
                        this.stack.state = xsChildNodes;
                        this.stackUp();
                        if (isAlpha(c)) {
                            this.str.pos = 0;
                            this.stack.state = xsElementName;
                            this.stack.clazz = xcElement;
                            continue;
                        } else {
                            return false;
                        }
                }
                break;
            case xsCloseElementName:
                if (this.str.pos == this.position) {
                    this.stack.savedstate = xsCloseEmptyElement;
                    this.stack.state = xsEatSpaces;
                    continue;
                } else {
                    if (c != this.str.buffer[this.position]) {
                        return false;
                    }
                    this.position++;
                }
                break;
            case xsAttributes:
                switch (c) {
                    case CHAR_QUES:
                        if (this.stack.clazz != xcProcessInst) {
                            return false;
                        }
                        this.stack.state = xsCloseElementPI;
                        break;
                    case CHAR_SLAH:
                        this.stack.state = xsCloseEmptyElement;
                        break;
                    case CHAR_GREA:
                        this.stack.state = xsChildNodes;
                        break;
                    default:
                        if (isAlpha(c)) {
                            this.str.pos = 0;
                            this.str.append(c);
                            this.stack.state = xsAttributeName;
                            break;
                        } else {
                            return false;
                        }

                }
                break;
            case xsAttributeName:
                if (isAlphaNum(c)) {
                    this.str.append(c);
                    break;
                } else {
                    this.stack.state = xsEatSpaces;
                    this.stack.savedstate = xsEqual;
                    continue;
                }
            case xsEqual:
                if (c != CHAR_EQUA) {
                    return false;
                }
                this.stack.state = xsEatSpaces;
                this.stack.savedstate = xsAttributeValue;
                this.value.pos = 0;
                this.position = 0;
                delete this.quote;
                break;
            case xsAttributeValue:
                if (this.quote) {
                    if (c == this.quote) {
                        if (this.stack.clazz != xcProcessInst) {
                            event(xtAttribute, this.str.toString(), this.value.toString(this.encoding));
                        }  else if (this.str == STR_ENCODING) {
                            this.encoding = this.value.toString();
                        }


                        this.stack.savedstate = xsAttributes;
                        this.stack.state = xsEatSpaces;
                    } else {
                        switch (c) {
                            case CHAR_AMPE:
                                this.stack.state = xsEscape;
                                this.stack.savedstate = xsAttributeValue;
                                break;
                            default:
                                this.value.append(c);
                        }
                    }
                } else {
                   if (c == CHAR_SINQ || c == CHAR_DBLQ) {
                       this.quote = c;
                       this.position++;
                   } else {
                       return false;
                   }
                }
                break;
            case xsElementString:
                switch (c) {
                    case CHAR_LESS:
                        if (!event(xtText, this.value.toString(this.encoding))) {
                            return false;
                        }
                        this.stack.state = xsTryCloseElement;
                        break;
                    case CHAR_AMPE:
                        this.stack.state = xsEscape;
                        this.stack.savedstate = xsElementString;
                        break;
                    default:
                        this.value.append(c);
                }
                break;
            case xsElementComment:
                switch (this.position) {
                    case 0:
                        switch (c) {
                            case CHAR_MINU:
                                this.position++;
                                break;
                            case CHAR_LEBR:
                                this.value.pos = 0;
                                this.position = 0;
                                this.stack.state = xsElementCDATA;
                                this.stack.clazz = xcCdata;
                                break;
                            default:
                                this.stack.state = xsDoctype;
                        }
                        break;
                    case 1:
                        if (c != CHAR_MINU) {
                            return false;
                        }
                        this.str.pos = 0;
                        this.position++;
                        break;
                    default:
                        if (c !== CHAR_MINU) {
                            this.str.append(c);
                        } else {
                            this.position = 0;
                            this.stack.state = xsCloseElementComment;
                        }
                }
                break;
            case xsCloseElementComment:
                switch (this.position) {
                    case 0:
                        if (c != CHAR_MINU) {
                            this.position = 2;
                            this.stack.state = xsElementComment;
                        } else {
                            this.position++;
                        }
                        break;
                    case 1:
                        if (c != CHAR_GREA) {
                            return false;
                        }
                        event(xtComment, this.str.toString(this.encoding));
                        if (this.stack.savedstate == xsStart)
                            this.stack.state = xsEatSpaces;
                        else
                            this.stack.state = xsChildNodes;
                        break;
                    default:
                        return false;
                }
                break;
            case xsDoctype:
                // todo: parse elements ...
                if (c == CHAR_GREA) {
                    
                    if (this.stack.prev) {
                        this.stack.state = xsChildNodes
                    } else {
                        this.stack.state = xsEatSpaces;
                        this.stack.savedstate = xsStart;
                    }
                }
                break;
            case xsElementCDATA:
                switch (this.position) {
                    case 0:
                        if (c == CHAR_C) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    case 1:
                        if (c == CHAR_D) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    case 2:
                        if (c == CHAR_A) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    case 3:
                        if (c == CHAR_T) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    case 4:
                        if (c == CHAR_A) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    case 5:
                        if (c == CHAR_LEBR) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    default:
                        if (c == CHAR_RIBR) {
                            this.position = 0;
                            this.stack.state = xsClodeElementCDATA;
                        } else {
                            this.value.append(c);
                        }
                }
                break;
            case xsClodeElementCDATA:
                switch (this.position) {
                    case 0:
                        if (c == CHAR_RIBR) {
                            this.position++;
                        } else {
                            this.value.append(CHAR_RIBR);
                            this.value.append(c);
                            this.position = 6;
                            this.stack.state = xsElementCDATA;
                        }
                        break;
                    case 1:
                        switch (c) {
                            case CHAR_GREA:
                                if (!event(xtCData, this.value.toString(this.encoding))) {
                                    return false;
                                }
                                this.stack.state = xsChildNodes;
                                break;
                            case CHAR_RIBR:
                                this.value.append(c);
                                break;
                        }
                        break;
                    default:
                        this.value.append(c);
                        this.stack.state = xsElementCDATA;
                }
                break;
            case xsEscape:
                this.position = 0;
                switch (c) {
                    case CHAR_l:
                        this.stack.state = xsEscape_lt;
                        break;
                    case CHAR_g:
                        this.stack.state = xsEscape_gt;
                        break;
                    case CHAR_a:
                        this.stack.state = xsEscape_amp;
                        break;
                    case CHAR_q:
                        this.stack.state = xsEscape_quot;
                        break;
                    case CHAR_SHRP:
                        this.stack.state = xsEscape_char;
                        break;
                    default:
                        return false;
                }
                break;
            case xsEscape_lt:
                switch (this.position) {
                    case 0:
                        if (c != CHAR_t) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 1:
                        if (c != CHAR_SCOL) {
                            return false;
                        }
                        this.value.append(CHAR_LESS);
                        this.stack.state = this.stack.savedstate;
                        break;
                    default:
                        return false;
                }
                break;
            case xsEscape_gt:
                switch (this.position) {
                    case 0:
                        if (c != CHAR_t) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 1:
                        if (c != CHAR_SCOL) {
                            return false;
                        }
                        this.value.append(CHAR_GREA);
                        this.stack.state = this.stack.savedstate;
                        break;
                    default:
                        return false;
                }
                break;
            case xsEscape_amp:
                switch (this.position) {
                    case 0:
                        switch (c) {
                            case CHAR_m:
                                this.position++;
                                break;
                            case CHAR_p:
                                this.stack.state = xsEscape_apos;
                                this.position++;
                                break;
                            default:
                                return false;
                        }
                        break;
                    case 1:
                        if (c != CHAR_p) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 2:
                        if (c != CHAR_SCOL) {
                            return false;
                        }
                        this.value.append(CHAR_AMPE);
                        this.stack.state = this.stack.savedstate;
                        break;
                    default:
                        return false;
                }
                break;
            case xsEscape_apos:
                switch (this.position) {
                    case 0:
                        switch (c) {
                            case CHAR_p:
                                this.position++;
                                break;
                            case CHAR_m:
                                this.stack.state = xsEscape_amp;
                                this.position++;
                                break;
                            default:
                                return false;
                        }
                        break;
                    case 1:
                        if (c != CHAR_o) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 2:
                        if (c != CHAR_s) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 3:
                        if (c != CHAR_SCOL) {
                            return false;
                        }
                        this.value.append(CHAR_SINQ);
                        this.stack.state = this.stack.savedstate;
                        break;
                }
                break;
            case xsEscape_quot:
                switch (this.position) {
                    case 0:
                        if (c != CHAR_u) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 1:
                        if (c != CHAR_o) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 2:
                        if (c != CHAR_t) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 3:
                        if (c != CHAR_SCOL) {
                            return false;
                        }
                        this.value.append(CHAR_DBLQ);
                        this.stack.state = this.stack.savedstate;
                        break;
                    default:
                        return false;
                }
                break;
            case xsEscape_char:
                if (isNum(c)) {
                    this.position = c - CHAR_ZERO;
                    this.stack.state = xsEscape_char_num;
                } else if (c == CHAR_x) {
                    this.stack.state = xsEscape_char_hex;
                } else {
                    return false;
                }
                break;
            case xsEscape_char_num:
                if (isNum(c)) {
                    this.position = (this.position * 10) + (c - CHAR_ZERO);
                } else if (c == CHAR_SCOL) {
                    this.value.append(this.position);
                    this.stack.state = this.stack.savedstate;
                } else {
                    return false;
                }
                break;
            case xsEscape_char_hex:
                if (isHex(c)) {
                    this.position = (this.position * 16) + hexDigit(c);
                } else if (c == CHAR_SCOL) {
                    this.value.append(this.position);
                    this.stack.state = this.stack.savedstate;
                } else {
                    return false;
                }
                break;
            case xsEnd:
                this.stackDown();
                continue;
            default:
                return false;
        }
        i++;
        if (i >= len) break;
        c = buffer[i];
        if (c !== CHAR_LF) {
            this.col++;
        } else {
            this.col = 0;
            this.line++;
        }
    }
};

XMLParser.prototype.parseString = function(str, event) {
    var buf = new Buffer(str);
    this.parseBuffer(buf, buf.length, event);
};

// ------------------------------

var SAXParseFile = exports.SAXParseFile = function(path, event, callback) {
    fs.open(path, 'r', function(err, fd) {
        var buffer = new Buffer(BUFFER_LENGTH);
        var parser = new XMLParser();
        if (!err) {
            function cb(err, br) {
                if (!err) {
                    if (br > 0) {
                        buffer = stripBom(buffer);
                        var ret = parser.parseBuffer(buffer, buffer.length, event);
                        if (ret === undefined){
                            fs.read(fd, buffer, 0, buffer.length, null, cb);
                        } else if (ret === true) {
                            if (callback) {
                                callback()
                            }
                        } else if (ret === false) {
                            if (callback) {
                                callback("parsing error at line: " + parser.line + ", col: " + parser.col)
                            }
                        }
                    } else {
                        fs.close(fd);
                    }
                } else {
                    fs.close(fd);
                    if (callback)
                        callback(err);
                }
            }
            fs.read(fd, buffer, 0, BUFFER_LENGTH, null, cb);
        } else {
            if (callback)
                callback(err);
        }
    });
};

var SAXParseFileSync = exports.SAXParseFileSync = function(path, event) {
    var fd = fs.openSync(path, 'r');
    try {
        var buffer = new Buffer(BUFFER_LENGTH);
        var parser = new XMLParser();
        var br = fs.readSync(fd, buffer, 0, BUFFER_LENGTH);
        while (br > 0) {
            buffer = stripBom(buffer);
            var ret = parser.parseBuffer(buffer, buffer.length, event);
            if (ret === undefined){
                br = fs.readSync(fd, buffer, 0, buffer.length);
            } else if (ret === true) {
                return
            } else if (ret === false) {
                throw new Error("parsing error at line: " + parser.line + ", col: " + parser.col)
            }
        }
    } finally {
        fs.closeSync(fd);
    }
};

function processEvent(stack, state, p1, p2) {
    var node, parent;
    switch (state) {
        case xtOpen:
            node = {name: p1};
            stack.push(node);
            break;
        case xtClose:
            node = stack.pop();
            if (stack.length) {
                parent = stack[stack.length-1];
                if (parent.childs) {
                    parent.childs.push(node)
                } else {
                    parent.childs = [node];
                }
            }
            break;
        case xtAttribute:
            parent = stack[stack.length-1];
            if (!parent.attrib) {
                parent.attrib = {};
            }
            parent.attrib[p1] = p2;
            break;
        case xtText:
        case xtCData:
            parent = stack[stack.length-1];
            if (parent.childs) {
                parent.childs.push(p1)
            } else {
                parent.childs = [p1];
            }
            break;
    }
    return node;
}

exports.parseFile = function(path, callback) {
    var stack = [], node;
    SAXParseFile(path,
        function(state, p1, p2) {
            node = processEvent(stack, state, p1, p2);
            return true;
        },
        function(err){
            if (callback) {
                callback(err, node);
            }
        }
    );
};

exports.parseFileSync = function(path) {
    var stack = [];
    var node = null;
    SAXParseFileSync(path,
        function(state, p1, p2) {
            node = processEvent(stack, state, p1, p2);
            return true;
        }
    );
    return node;
};

var parseBuffer = exports.parseBuffer = function(buffer) {
    var node = null,
        parser = new XMLParser(),
        stack = [];

    buffer = stripBom(buffer);
    var ret = parser.parseBuffer(buffer, buffer.length,
        function(state, p1, p2) {
            node = processEvent(stack, state, p1, p2);
            return true;
        }
    );

    if (ret === false) {
        throw new Error("parsing error at line: " + parser.line + ", col: " + parser.col)
    }
    return node;
};

var stripBom = function(x) {
    if (typeof x === 'string' && x.charCodeAt(0) === 0xFEFF) {
        return x.slice(1);
    }

    if (Buffer.isBuffer(x) && x[0] === 0xEF && x[1] === 0xBB && x[2] === 0xBF) {
        return x.slice(3);
    }

    return x;
};

exports.parseString = function(str) {
   str = stripBom(str);
   return parseBuffer(new Buffer(str));
};

