
const crypto = require('crypto');
let sequenceNumber;
let timerInterval = 10;
let timer;

function timerRun() {
    timer ++;
    if (timer == 4294967295) {
        timer = Math.floor(1000 * Math.random()); // reset timer to be within 32 bit size
    }
}

module.exports = {
    init: function() {
        timer = Math.floor(1000 * Math.random()); /* any random number */
        setInterval(timerRun, timerInterval);
        sequenceNumber = Math.floor(1000 * Math.random()); /* any random number */
    },

    //--------------------------
    //getSequenceNumber: return the current sequence number + 1
    //--------------------------
    getSequenceNumber: function() {
        sequenceNumber ++;
        return sequenceNumber;
    },

    //--------------------------
    //getTimestamp: return the current timer value
    //--------------------------
    getTimestamp: function() {
        return timer;
    },

    //--------------------------
    //getrandom port > 3000
    //--------------------------
    getPort: function() {
        var weight = Math.floor(Math.random()*1000)+1;
        return  Math.floor( Math.random()*weight) + 3001;
    },

    //--------------------------
    //getPeerID: takes the IP and port number and returns 4 bytes Hex number
    //--------------------------
    getPeerID: function (IP, port) {
        // Combine IP and port to create a unique string for each peer
        const input = IP + ':' + port;
        // Use SHAKE256 hash function
        const hash = crypto.createHash('shake256');
        // Update the hash with the input string
        hash.update(input);
        // Return a 4-byte hash as a hex string
        return hash.digest('hex').slice(0, 8); // 8 hex characters represent 4 bytes
    },


        //--------------------------
    //getBucketPrefix: calculates the common prefix length of two peer IDs in binary representation
    //--------------------------
    getBucketPrefix: function(peerID1, peerID2) {
        const binary1 = this.Hex2Bin(peerID1);
        const binary2 = this.Hex2Bin(peerID2);
        let prefixLength = 0;
        for (let i = 0; i < binary1.length; i++) {
            if (binary1[i] !== binary2[i]) break;
            prefixLength++;
        }
        return prefixLength;
    },

   
    //--------------------------
    //Hex2Bin: convert Hex string into binary string
    //--------------------------
    Hex2Bin: function (hex) {
        var bin = ""
        hex.split("").forEach(str => {
            bin += parseInt(str, 16).toString(2).padStart(8, '0')
        })
        return bin
    },

    //--------------------------
    //XORing: finds the XOR of the two Binary Strings with the same size
    //--------------------------
    XORing: function (a, b){
    let ans = "";
        for (let i = 0; i < a.length ; i++)
        {
            // If the Character matches
            if (a[i] == b[i])
                ans += "0";
            else
                ans += "1";
        }
        return ans;
    }


};