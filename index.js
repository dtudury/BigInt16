var BigInt16 = function () {
    this.digits = [];
    this.sign = 1;
    if(!arguments) return;
    var arg = arguments[0];
    if (arg) {
        var typeString = Object.prototype.toString.call(arg);
        if (typeString === "[object Array]") {
            this.digits = arg;
        } else if (typeString === "[object Number]") {
            if (arg < 0) this.sign = -1;
            arg = Math.round(Math.abs(arg));
            while (arg) {
                this.digits.push( arg % 0x10000); //keep this a float if we can
                arg = Math.floor(arg / 0x10000);
            }
        } else if (typeString === "[object String]") {
            if (arg.match(/^0[xX]/)) {
                arg = arg.slice(2);
                while(arg.length) {
                    this.digits.push(parseInt(arg.slice(-4), 16));
                    arg = arg.slice(0, -4);
                }
                return;
            }
            if (arg.charAt(0) === "-") {
                this.sign = -1;
                arg = arg.slice(1);
            }
            for (var i = 0; i < arg.length; i++) {
                var multiplier = 1;//10;
                var digit = "";//arg.charAt(i);
                for(var j = 0; j < 14 && i + j < arg.length; j++) {
                    digit += arg.charAt(i + j);
                    multiplier *= 10;
                }
                i += j - 1;
                this.multiplyAndSet(new BigInt16(multiplier));
                this.addAndSet(new BigInt16(parseInt(digit)));
            }
        }
    }
};


BigInt16.prototype.clone = function () {
    var output = new BigInt16();
    output.digits = this.digits.slice(0);
    output.sign = this.sign;
    return output;
};

BigInt16.prototype.set = function (n) {
    this.digits = n.digits.slice(0);
    this.sign = n.sign;
    return this;
}


BigInt16.prototype.toString = function () {
    var output = "";
    for (var i = 0; i < this.digits.length; i++) {
        var str = this.digits[i].toString(16);
        while (str.length < 4) str = "0" + str;
        output = str + output;
    }
    if (this.sign === -1) output = "-" + output;
    return output;
};

BigInt16.prototype.compare = function (n, ignoreSign) {
    if (!ignoreSign) {
        if (this.sign > n.sign) return 1;
        if (this.sign < n.sign) return -1;
    }
    if (this.digits.length > n.digits.length) return 1;
    if (this.digits.length < n.digits.length) return -1;
    for (var i = this.digits.length - 1; i >= 0; i--) {
        if (this.digits[i] > n.digits[i]) return 1;
        if (this.digits[i] < n.digits[i]) return -1;
    }
    return 0;
};

BigInt16.prototype.gt = function (n) { return this.compare(n) === 1};
BigInt16.prototype.ge = function (n) { return this.compare(n) >= 0};
BigInt16.prototype.lt = function (n) { return this.compare(n) === -1};
BigInt16.prototype.le = function (n) { return this.compare(n) <= 0};
BigInt16.prototype.eq = function (n) { return this.compare(n) === 0};
BigInt16.prototype.ne = function (n) { return this.compare(n) !== 0};

BigInt16.prototype.addAndSet = function (n) {
    var carry = 0;
    if(this.sign == n.sign) {
        var maxDigits = Math.max(this.digits.length, n.digits.length);
        for (var i = 0; i < maxDigits; i++) {
            var augend = this.digits[i] || 0;
            var addend = n.digits[i] || 0;
            var sum = augend + addend + carry;
            carry = sum >>> 16;
            this.digits[i] = sum & 0xffff;
        }
        if (carry) {
            this.digits.push(carry);
        }
    } else {
        var difference;
        if(this.gt(n)) {
            difference = _subtractFromPositive(this, n);
        } else {
            difference = _subtractFromPositive(n, this);
            difference.sign = n.sign;
        }
        this.set(difference);
    }
    return this;
};

function _subtractFromPositive(minuend, subtrahend) {
    var output = minuend.clone();
    output.sign = 1;
    for (var i = subtrahend.digits.length - 1; i >= 0; i--) {
        if (minuend.digits[i] >= subtrahend.digits[i]) {
            output.digits[i] = minuend.digits[i] - subtrahend.digits[i];
        } else {
            output.digits[i] = 0x10000 + minuend.digits[i] - subtrahend.digits[i];
            for( var j = i + 1; output.digits[j] === 0; j++) {
                output.digits[j] = 0xffff;
            }
            output.digits[j] = output.digits[j] - 1;
        }
    }
    while(output.digits[output.digits.length - 1] === 0) {
        output.digits.pop();
    }
    return output;
}

BigInt16.prototype.add = function (n) {
    var output = this.clone();
    return output.addAndSet(n);
};

BigInt16.prototype.subtractAndSet = function (n) {
    var subtrahend = n.clone();
    subtrahend.sign = -subtrahend.sign;
    return this.addAndSet(subtrahend);
};

BigInt16.prototype.subtract = function (n) {
    var output = this.clone();
    var subtrahend = n.clone();
    subtrahend.sign = -subtrahend.sign;
    return output.addAndSet(subtrahend);
};

BigInt16.prototype.leftShiftAndSet = function (n) {
    var microshift = n % 16;
    if (microshift) {
        var carry = 0;
        for(var i = 0; i < this.digits.length; i++) {
            var result = this.digits[i] << microshift | carry;
            carry = result >>> 16;
            this.digits[i] = result & 0xffff;
        }
    }
    var macroshift = n >>> 4;
    for (var i = 0; i < macroshift; i++) {
        this.digits.unshift(0);
    }
    if (carry) {
        this.digits.push(carry);
    }
    return this;
}

BigInt16.prototype.leftShift = function (n) {
    var output = this.clone();
    output.leftShiftAndSet(n);
    return output;
};


BigInt16.prototype.rightShiftAndSet = function (n) {
    var macroshift = n >>> 4;
    this.digits = this.digits.slice(macroshift);
    var microshift = n % 16;
    var inverseMicroShift = 16 - microshift;
    if (microshift) {
        var carry = 0;
        for(var i = this.digits.length - 1; i >= 0; i--) {
            var result = this.digits[i] >>> microshift | carry;
            carry = (this.digits[i] << inverseMicroShift) & 0xffff;
            this.digits[i] = result;
        }
    }
    while(this.digits[this.digits.length - 1] === 0) {
        this.digits.pop();
    }
    return this;
}

BigInt16.prototype.multiply = function (n) {
    var output = new BigInt16();
    output.sign = this.sign * n.sign;
    for (var i = 0; i < this.digits.length; i++) {
        var multiplicand = this.digits[i];
        for (var j = 0; j < n.digits.length; j++) {
            var product = new BigInt16(multiplicand * n.digits[j]);
            product.leftShiftAndSet((i + j) * 16);
            output.addAndSet(product);
        }
    }
    return output;
}

BigInt16.prototype.multiplyAndSet = function (n) {
    return this.set(this.multiply(n));
};

BigInt16.prototype.divide = function (n) {
    return this.divideAndMod(this, n)[0];
};

BigInt16.prototype.divideAndSet = function (n) {
    return this.set(this.divide(n));
};

BigInt16.prototype.mod = function (n) {
    return this.divideAndMod(this, n)[1];
};

BigInt16.prototype.modAndSet = function (n) {
    return this.set(this.mod(n));
};


BigInt16.prototype.divideAndMod = function(dividend, divisor) {
    var quotient = new BigInt16();
    var remainder = dividend.clone();
    while(remainder.ge(divisor)) {
        var offset = 16 * Math.max(remainder.digits.length - divisor.digits.length - 1, 0);
        var lastShift;
        var shifted = divisor.leftShift(offset);
        do {
            offset++;
            lastShift = shifted;
            shifted = divisor.leftShift(offset);
            var nextShift = divisor.leftShift(offset);
        } while (remainder.ge(shifted));
        offset--;
        remainder.subtractAndSet(lastShift);
        quotient.addAndSet((new BigInt16(1)).leftShift(offset));
    }
    return [quotient, remainder];
};

BigInt16.prototype.aToBModC = function(exponent, divisor) {
    exponent = exponent.clone();
    var power = this.clone();
    var result =  new BigInt16(1);
    while(exponent.digits.length) {
        if(exponent.digits[0] % 2) {
            result.multiplyAndSet(power).modAndSet(divisor);
        }
        power.multiplyAndSet(power).modAndSet(divisor);
        exponent.rightShiftAndSet(1);
    }
    return result;
};

module.exports = BigInt16;