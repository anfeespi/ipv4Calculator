class Utils {
    static dec2bin(val) {
      const asBits = val.toString(2).split('').map(Number);
      
      while (asBits.length < 8) {
        asBits.unshift(0);
      }
      
      return asBits;
    }

    static bin2dec(arrayBits) {
      return parseInt(arrayBits.join(''), 2);
    }
    
    static cidrToDec(mask) {
      let val = 0;
      let bit = 0x40000000;
      for (let i = 1; i < mask; i++) {
        val |= bit;
        bit >>>= 1;
      }
      return [
        ((val & 0xFF000000) >> 24) | 0x80, // set the most significant bit to 1
        (val & 0x00FF0000) >> 16,
        (val & 0x0000FF00) >> 8,
        val & 0x000000FF
      ];
    }
}

class IPv4Format {
    constructor(o1, o2, o3, o4) {
      this._octets = [o1, o2, o3, o4].map(Number);
      if (this._octets.length != 4                || 
          this._octets.some(o => Number.isNaN(o)) ||
          this._octets.some(o => o < 0)           ||
          this._octets.some(o => o > 255)
         ) {
        throw "Invalid IP Address";
      }
      this._bits = [];
      this._toBinary();    
    }
  
    _toBinary() {
      this._octets.forEach(
        o => Utils.dec2bin(o).forEach(i => this._bits.push(i))
      );
    }
  
    bit(num) {
      return this._bits[num];
    }
    
    octet(num) {
      return this._octets[num];
    }
    toString() {
      return this._octets.join('.');
    }
}
  
class IPv4Mask extends IPv4Format {
    constructor(mask) {
      const octets = Utils.cidrToDec(mask);
      super(octets[0], octets[1], octets[2], octets[3]);
      this._cidr = mask;
    }
    get cidr() {
      return this._cidr;
    }
}
  
class IPv4Address extends IPv4Format {
    static PUBLIC = -1;
    static CLASS_A = 0;
    static CLASS_B = 1;
    static CLASS_C = 2;
    
    constructor(o1, o2, o3, o4) {
      super(o1, o2, o3, o4);
    }
    
    set mask(themask) {
      this._mask = themask;
    }
    
    get mask() {
      return this._mask;
    }
    
    get netId() {
      return new IPv4Format(
        this.octet(0) & this.mask.octet(0),
        this.octet(1) & this.mask.octet(1),
        this.octet(2) & this.mask.octet(2),
        this.octet(3) & this.mask.octet(3)
      );
    }
    
    get broadcast() {
      // & 0xFF otherwise, as numbers are coded on 32 bits
      // this would return a negative number.
      return new IPv4Format(
        (this.octet(0) | ~this.mask.octet(0)) & 0xFF,
        (this.octet(1) | ~this.mask.octet(1)) & 0xFF,
        (this.octet(2) | ~this.mask.octet(2)) & 0xFF,
        (this.octet(3) | ~this.mask.octet(3)) & 0xFF
      );
    }
    
    get privateClass() {
      if (this.octet(0) == 192 && this.octet(1) == 168) {
        return IPv4Address.CLASS_C;
      }
      console.log(`${this.octet(1)}, ${this.octet(1) & 240}`);
      if (this.octet(0) == 172 && (this.octet(1) & 240) == 16) {
        return IPv4Address.CLASS_B;
      }
      if (this.octet(0) == 10) {
        return IPv4Address.CLASS_A;
      }
      return IPv4Address.PUBLIC;
    }

    get firstUtil(){
      let auxNet = this.netId;
      auxNet._octets[3] += 1;
      return auxNet;
    }

    get lastUtil(){
      let auxBroadcast = this.broadcast;
      auxBroadcast._octets[3] -= 1;
      return auxBroadcast;
    }

    get hostQuantity(){
      return Math.pow(2, 32 - this.mask._cidr) - 2;
    }

    get netPartition(){
      let p = [];

      p[0] = this._bits.slice(0, 8).join("");
      p[1] = this._bits.slice(8, 16).join("");
      p[2] = this._bits.slice(16, 24).join("");
      p[3] = this._bits.slice(24, 32).join("")
      
      let partitions = p.join(".");

      let sum = 0;
      if(this.mask.cidr >= 24)
        sum = 3;
      else if(this.mask.cidr >= 16)
        sum = 2
      else if(this.mask.cidr >= 8)
        sum = 1;

      let partitionNet = partitions.substring(0, parseInt(this.mask.cidr) + sum);
      
      return partitionNet;
    }

    get hostPartition(){
      let p = [];

      p[0] = this._bits.slice(0, 7).join("");
      p[1] = this._bits.slice(8, 15).join("");
      p[2] = this._bits.slice(16, 23).join("");
      p[3] = this._bits.slice(24, 32).join("")
      
      let partitions = p.join(".");

      let sum = 3;
      if(this.mask.cidr >= 24)
        sum = 0;
      else if(this.mask.cidr >= 16)
        sum = 1;
      else if(this.mask.cidr >= 8)
        sum = 2;

      let partitionHost = partitions.substring(this.mask.cidr, 35);
      
      return partitionHost;
    }
}
  
const ip1 = document.querySelector("#ip1");
const ip2 = document.querySelector("#ip2");
const ip3 = document.querySelector("#ip3");
const ip4 = document.querySelector("#ip4");
  
[ip1, ip2, ip3, ip4].forEach(field => field.addEventListener('input', computeIp));
  
const ipBinRowElt = document.querySelector("#ipbin");
  
const maskElt = document.querySelector("#cidr");
maskElt.addEventListener('input', computeIp);
  
const maskDecElt = document.querySelector("#maskDec");
const maskDecEltCells = maskDecElt.querySelectorAll("td:not(.spacer)");
  
const netIDTable = document.querySelector("#netid");
const broadcastTable = document.querySelector("#broadcast");
  
const classAcb = document.querySelector("#classA");
const classBcb = document.querySelector("#classB");
const classCcb = document.querySelector("#classC");
const publiccb = document.querySelector("#public");
  
function addBinToCells(cells, fnval, mask) {
    for (const [index, cell] of cells.entries()) {
      cell.textContent = fnval(index);
      cell.classList.remove('mask');
      if (index < mask) {
        cell.classList.add('mask');
      }
    }
}
  
  function addDecToCells(cells, fnval) {
    for (const [index, cell] of cells.entries()) {
      cell.textContent = fnval(index);
    }
  }
  
  function addIp(ip) {
    const cells = ipBinRowElt.querySelectorAll("td:not(.spacer)");
    addBinToCells(cells, i => ip.bit(i), ip.mask.cidr);
  }
  
  function addMask(ip) {
    addDecToCells(maskDecEltCells, i => ip.mask.octet(i));
    const maskcells = document.querySelectorAll("tr#mask > td:not(.spacer)");
    addBinToCells(maskcells, i => ip.mask.bit(i), ip.mask.cidr);
  }
  
  function addNetId(ip) {
    const ipaddrdeccells = netIDTable.querySelectorAll("tr[data-content=ipaddrdec] td:not(.spacer)");
    addDecToCells(ipaddrdeccells, (i) => ip.octet(i));
    
    const ipaddrcells = netIDTable.querySelectorAll("tr.ipbin td:not(.spacer)");
    addBinToCells(ipaddrcells, (i) => ip.bit(i), ip.mask.cidr);
  
    const maskcells = netIDTable.querySelectorAll("tr.maskbin td:not(.spacer)");
    addBinToCells(maskcells, (i) => ip.mask.bit(i), ip.mask.cidr);
    
    const netidcells = netIDTable.querySelectorAll("tr[data-content=netid] td:not(.spacer)");
    addBinToCells(netidcells, (i) => ip.netId.bit(i), ip.mask.cidr);
    
    const netiddeccells = netIDTable.querySelectorAll("tr[data-content=netiddec] td:not(.spacer)");
    addDecToCells(netiddeccells, (i) => ip.netId.octet(i));  
  }
  
  function addBroadcast(ip) {
    const ipaddrdeccells = broadcastTable.querySelectorAll("tr[data-content=ipaddrdec] td:not(.spacer)");
    addDecToCells(ipaddrdeccells, (i) => ip.octet(i));
    
    const ipaddrcells = broadcastTable.querySelectorAll("tr.ipbin td:not(.spacer)");
    addBinToCells(ipaddrcells, (i) => ip.bit(i), ip.mask.cidr);
  
    const maskcells = broadcastTable.querySelectorAll("tr.maskbin td:not(.spacer)");
    addBinToCells(maskcells, (i) => ip.mask.bit(i) ? '0' : '1', ip.mask.cidr);
    
    const broadcastidcells = broadcastTable.querySelectorAll("tr.broadcast td:not(.spacer)");
    addBinToCells(broadcastidcells, (i) => ip.broadcast.bit(i), ip.mask.cidr);
    
    const broadcastiddeccells = broadcastTable.querySelectorAll("tr.broadcastdec td:not(.spacer)");
    addDecToCells(broadcastiddeccells, (i) => ip.broadcast.octet(i));  
  }
  
  function setClass(ip) {
    const privateClass = ip.privateClass;
    console.log(`class: ${privateClass}`);
    switch (ip.privateClass) {
      case IPv4Address.CLASS_A:
        classAcb.checked = true;
        break;
      case IPv4Address.CLASS_B:
        classBcb.checked = true;
        break;
      case IPv4Address.CLASS_C:
        classCcb.checked = true;
        break;
      default:
        publiccb.checked = true;
    }
  }
  
  function computeIp() {
    const mask = new IPv4Mask(maskElt.value);
    ipaddr = new IPv4Address(ip1.value, ip2.value, ip3.value, ip4.value);
    ipaddr.mask = mask;
    
    addIp(ipaddr);
    addMask(ipaddr);
    addNetId(ipaddr);
    addBroadcast(ipaddr);
    setClass(ipaddr);
    
    document.querySelectorAll('output.addressipdec').forEach(e => e.textContent = ipaddr);
    document.querySelectorAll('output.cidr').forEach(e => e.textContent = ipaddr.mask.cidr);
    document.querySelectorAll('output.netiddec').forEach(e => e.textContent = ipaddr.netId);
    document.querySelectorAll('output.broadcastipdec').forEach(e => e.textContent = ipaddr.broadcast);
    
    document.querySelectorAll('output.hostquantity').forEach(e => e.textContent = ipaddr.hostQuantity);
    document.querySelectorAll('output.firstutilip').forEach(e => e.textContent = ipaddr.firstUtil);
    document.querySelectorAll('output.lastutilip').forEach(e => e.textContent = ipaddr.lastUtil);
    document.querySelectorAll('output.netpartition').forEach(e => e.textContent = ipaddr.netPartition);
    document.querySelectorAll('output.hostpartition').forEach(e => e.textContent = ipaddr.hostPartition);
  }
  
  function getBitClicked(e) {
    let num = -1;
    for (let p = e.previousSibling; p ; p = p.previousSibling, num++) {} 
    num -= Math.floor(num / 9);
    return num;
  }
  
  function changeMask(e) {
    maskElt.value = getBitClicked(e) + 1;
    computeIp();
  }
  
  function changeIp(e) {
    const bit = getBitClicked(e);
    const octet = Math.floor(bit / 8);
    const current = ipaddr.octet(octet);
    const newValue = (current ^ (0x80 >>> (bit % 8))) & 0xFF;
    [ip1, ip2, ip3, ip4][octet].value = newValue;
    computeIp();
  }
  
  document.querySelectorAll('.spacer').forEach(cell => cell.textContent = ' . ');
  document.querySelectorAll('tr.maskbin td:not(.spacer)').forEach(cell =>
    cell.addEventListener('click', e => changeMask(e.target))
  );
  
  document.querySelectorAll('tr.ipbin td:not(.spacer)').forEach(cell =>
    cell.addEventListener('click', e => changeIp(e.target))
  );
  
  setIPClassListener = (elt, ip) => {
    const [b1, b2, b3, b4] = ip.split('.');
    elt.addEventListener('change', () => {
      ip1.value = b1;
      ip2.value = b2;
      ip3.value = b3;
      ip4.value = b4;
      computeIp();
    });
  };
  
  setIPClassListener(classAcb, '10.0.0.0');
  setIPClassListener(classBcb, '172.16.0.0')
  setIPClassListener(classCcb, '192.168.0.0');
  
  let ipaddr;
  computeIp();