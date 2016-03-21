var MFRC522 = {
  NRSTPD: 25, /// GPIO 25
  MAX_LEN: 16,
  
  PCD_IDLE:       0x00,
  PCD_AUTHENT:    0x0E,
  PCD_RECEIVE:    0x08,
  PCD_TRANSMIT:   0x04,
  PCD_TRANSCEIVE: 0x0C,
  PCD_RESETPHASE: 0x0F,
  PCD_CALCCRC:    0x03,
  
  PICC_REQIDL:    0x26,
  PICC_REQALL:    0x52,
  PICC_ANTICOLL:  0x93,
  PICC_SELECTTAG: 0x93,
  PICC_AUTHENT1A: 0x60,
  PICC_AUTHENT1B: 0x61,
  PICC_READ:      0x30,
  PICC_WRITE:     0xA0,
  PICC_DECREMENT: 0xC0,
  PICC_INCREMENT: 0xC1,
  PICC_RESTORE:   0xC2,
  PICC_TRANSFER:  0xB0,
  PICC_HALT:      0x50,
  
  MI_OK:          0,
  MI_NOTAGERR:    1,
  MI_ERR:         2,
  
  Reserved00:     0x00,
  CommandReg:     0x01,
  CommIEnReg:     0x02,
  DivlEnReg:      0x03,
  CommIrqReg:     0x04,
  DivIrqReg:      0x05,
  ErrorReg:       0x06,
  Status1Reg:     0x07,
  Status2Reg:     0x08,
  FIFODataReg:    0x09,
  FIFOLevelReg:   0x0A,
  WaterLevelReg:  0x0B,
  ControlReg:     0x0C,
  BitFramingReg:  0x0D,
  CollReg:        0x0E,
  Reserved01:     0x0F,
  
  Reserved10:     0x10,
  ModeReg:        0x11,
  TxModeReg:      0x12,
  RxModeReg:      0x13,
  TxControlReg:   0x14,
  TxAutoReg:      0x15,
  TxSelReg:       0x16,
  RxSelReg:       0x17,
  RxThresholdReg: 0x18,
  DemodReg:       0x19,
  Reserved11:     0x1A,
  Reserved12:     0x1B,
  MifareReg:      0x1C,
  Reserved13:     0x1D,
  Reserved14:     0x1E,
  SerialSpeedReg: 0x1F,
  
  Reserved20:     0x20,
  CRCResultRegM:  0x21,
  CRCResultRegL:  0x22,
  Reserved21:     0x23,
  ModWidthReg:       0x24,
  Reserved22:        0x25,
  RFCfgReg:          0x26,
  GsNReg:            0x27,
  CWGsPReg:          0x28,
  ModGsPReg:         0x29,
  TModeReg:          0x2A,
  TPrescalerReg:     0x2B,
  TReloadRegH:       0x2C,
  TReloadRegL:       0x2D,
  TCounterValueRegH: 0x2E,
  TCounterValueRegL: 0x2F,
  
  Reserved30:      0x30,
  TestSel1Reg:     0x31,
  TestSel2Reg:     0x32,
  TestPinEnReg:    0x33,
  TestPinValueReg: 0x34,
  TestBusReg:      0x35,
  AutoTestReg:     0x36,
  VersionReg:      0x37,
  AnalogTestReg:   0x38,
  TestDAC1Reg:     0x39,
  TestDAC2Reg:     0x3A,
  TestADCReg:      0x3B,
  Reserved31:      0x3C,
  Reserved32:      0x3D,
  Reserved33:      0x3E,
  Reserved34:      0x3F,
    
  serNum: [],
  
  init: function(dev, spd) {
   this.wpi = require("wiring-pi");
   this.wpi.wiringPiSPISetup(0, 1000000);
   this.wpi.setup("gpio");
   this.wpi.pinMode(this.NRSTPD, this.wpi.OUTPUT);
   this.wpi.digitalWrite(this.NRSTPD, this.wpi.HIGH);
   this.MFRC522_Init();
  },
  
  MFRC522_Reset: function() {
    this.Write_MFRC522(this.CommandReg, this.PCD_RESETPHASE);
  },
  
  Write_MFRC522: function(addr, val) {
    var data = [(addr<<1)&0x7E, val];
    var uint8Data = Uint8Array.from(data);
    this.wpi.wiringPiSPIDataRW(0, uint8Data);
  },
  
  Read_MFRC522: function(addr) {
    var data = [((addr<<1)&0x7E) | 0x80, 0];
    var uint8Data = Uint8Array.from(data);
    this.wpi.wiringPiSPIDataRW(0, uint8Data);
    return uint8Data[1]
  },
  
  SetBitMask: function(reg, mask) {
    var tmp = this.Read_MFRC522(reg);
    this.Write_MFRC522(reg, tmp | mask);
  },
    
  ClearBitMask: function(reg, mask) {
    var tmp = this.Read_MFRC522(reg);
    this.Write_MFRC522(reg, tmp & (~mask));
  },
  
  AntennaOn: function() {
    var temp = this.Read_MFRC522(this.TxControlReg);
    if(~(temp & 0x03) != 0) {
      this.SetBitMask(this.TxControlReg, 0x03);
    }
  },
  
  AntennaOff: function () {
    this.ClearBitMask(this.TxControlReg, 0x03);
  },
  
  MFRC522_ToCard: function(command, sendData) {
    var backData = [];
    var backLen = 0;
    var status = this.MI_ERR;
    var irqEn = 0x00;
    var waitIRq = 0x00;
    var lastBits = null;
    var n = 0;
    var i = 0;
    
    if (command == this.PCD_AUTHENT) {
      irqEn = 0x12;
      waitIRq = 0x10;
    }
    if (command == this.PCD_TRANSCEIVE) {
      irqEn = 0x77;
      waitIRq = 0x30;
    }
    
    this.Write_MFRC522(this.CommIEnReg, irqEn|0x80);
    this.ClearBitMask(this.CommIrqReg, 0x80);
    this.SetBitMask(this.FIFOLevelReg, 0x80);
    
    this.Write_MFRC522(this.CommandReg, this.PCD_IDLE);  
    
    while(i<sendData.length) {
      this.Write_MFRC522(this.FIFODataReg, sendData[i]);
      i = i+1;
    }
    
    this.Write_MFRC522(this.CommandReg, command);
      
    if (command == this.PCD_TRANSCEIVE) {
      this.SetBitMask(this.BitFramingReg, 0x80);
    }
    
    i = 2000;
    while (true) {
      n = this.Read_MFRC522(this.CommIrqReg);
      i = i - 1
      if (~((i!=0) && ~(n&0x01) && ~(n&waitIRq)) != 0) {
        break;
      }
    }
    
    this.ClearBitMask(this.BitFramingReg, 0x80);
  
    if (i != 0) {
      if ((this.Read_MFRC522(this.ErrorReg) & 0x1B) == 0x00) {
        status = this.MI_OK;

        if ((n & irqEn & 0x01) != 0) {
          status = this.MI_NOTAGERR;
        }
      
        if (command == this.PCD_TRANSCEIVE) {
          n = this.Read_MFRC522(this.FIFOLevelReg);
          lastBits = this.Read_MFRC522(this.ControlReg) & 0x07;
          if (lastBits != 0) {
            backLen = (n-1)*8 + lastBits;
          }
          else {
            backLen = n*8;
          }
          
          if (n == 0) {
            n = 1;
          }
          if (n > this.MAX_LEN) {
            n = this.MAX_LEN;
          }
    
          i = 0;
          while (i<n) {
            backData.push(this.Read_MFRC522(this.FIFODataReg));
            i = i + 1;
          }
        }
      }
      else {
        status = this.MI_ERR;
      }
    }
    return {status: status, backData: backData, backLen: backLen};
    //return (status,backData,backLen)
  },
  
  
  MFRC522_Request: function(reqMode) {
    var TagType = [];
    
    this.Write_MFRC522(this.BitFramingReg, 0x07);
    
    TagType.push(reqMode);
    //(status,backData,backBits) = self.MFRC522_ToCard(self.PCD_TRANSCEIVE, TagType)
    var obj = this.MFRC522_ToCard(this.PCD_TRANSCEIVE, TagType);
    var status = obj.status;
    var backData = obj.backData;
    var backBits = obj.backLen;
  
    if ((status != this.MI_OK) || (backBits != 0x10)) {
      status = this.MI_ERR;
    }
      
    return {status: status, backBits: backBits};
  },
  
  
  MFRC522_Anticoll: function() {
    var serNumCheck = 0;
    
    var serNum = [];
  
    this.Write_MFRC522(this.BitFramingReg, 0x00);
    
    serNum.push(this.PICC_ANTICOLL);
    serNum.push(0x20);
    
    //(status,backData,backBits) = self.MFRC522_ToCard(self.PCD_TRANSCEIVE,serNum)
    var obj = this.MFRC522_ToCard(this.PCD_TRANSCEIVE, serNum);
    var status = obj.status;
    var backData = obj.backData;
    var backBits = obj.backLen;
    
    if(status == this.MI_OK) {
      var i = 0;
      if (backData.length == 5) {
        while (i<4) {
          serNumCheck = serNumCheck ^ backData[i];
          i = i + 1;
        }
        if (serNumCheck != backData[i]) {
          status = this.MI_ERR;
        }
      }
      else {
        status = this.MI_ERR;
      }
    }
    return {status: status, backData: backData};
  },
  
  CalulateCRC: function(pIndata) {
    this.ClearBitMask(this.DivIrqReg, 0x04);
    this.SetBitMask(this.FIFOLevelReg, 0x80);
    var i = 0;
    while (i<pIndata.length) {
      this.Write_MFRC522(this.FIFODataReg, pIndata[i]);
      i = i + 1;
    }
    this.Write_MFRC522(this.CommandReg, this.PCD_CALCCRC);
    i = 0xFF;
    while(true) {
      var n = this.Read_MFRC522(this.DivIrqReg);
      i = i - 1;
      if (!((i != 0) && !((n & 0x04) != 0))) {
        break
      }
    }
    var pOutData = [];
    pOutData.push(this.Read_MFRC522(this.CRCResultRegL));
    pOutData.push(this.Read_MFRC522(this.CRCResultRegM));
    return pOutData;
  },
  
  MFRC522_SelectTag: function(serNum) {
    var buf = [];
    buf.push(this.PICC_SELECTTAG);
    buf.push(0x70);
    var i = 0;
    while(i<5) {
      buf.push(serNum[i]);
      i = i + 1;
    }
    var pOut = this.CalulateCRC(buf)
    buf.push(pOut[0]);
    buf.push(pOut[1]);
    //(status, backData, backLen) = self.MFRC522_ToCard(self.PCD_TRANSCEIVE, buf)
    var obj = this.MFRC522_ToCard(this.PCD_TRANSCEIVE, buf);
    var status = obj.status;
    var backData = obj.backData;
    var backLen = obj.backLen;
    
    if (status == this.MI_OK && backLen == 0x18) {
      console.log("Size: " + backData[0]);
      return backData[0];
    }
    else {
      return 0;
    }
  },
  
  MFRC522_Auth: function(authMode, BlockAddr, Sectorkey, serNum) {
    var buff = [];

    //# First byte should be the authMode (A or B)
    buff.push(authMode)

    //# Second byte is the trailerBlock (usually 7)
    buff.push(BlockAddr);

    //# Now we need to append the authKey which usually is 6 bytes of 0xFF
    var i = 0;
    while(i < Sectorkey.length) {
      buff.push(Sectorkey[i]);
      i = i + 1;
    }
    i = 0;

    // Next we append the first 4 bytes of the UID
    while(i < 4) {
      buff.push(serNum[i]);
      i = i +1;
    }

    // Now we start the authentication itself
    //(status, backData, backLen) = self.MFRC522_ToCard(self.PCD_AUTHENT,buff)
    var obj = this.MFRC522_ToCard(this.PCD_AUTHENT, buff);
    var status = obj.status;
    var backData = obj.backData;
    var backLen = obj.backLen;

    // Check if an error occurred
    if (!(status == this.MI_OK)) {
      console.log("AUTH ERROR!!");
    }
    if (!(this.Read_MFRC522(this.Status2Reg) & 0x08) != 0) {
      console.log("AUTH ERROR(status2reg & 0x08) != 0");
    }

    // Return the status
    return status;
  },
  
  MFRC522_StopCrypto1: function() {
    this.ClearBitMask(this.Status2Reg, 0x08);
  },

  MFRC522_Read: function(blockAddr) {
    var recvData = [];
    recvData.push(this.PICC_READ);
    recvData.push(blockAddr);
    var pOut = this.CalulateCRC(recvData);
    recvData.push(pOut[0]);
    recvData.push(pOut[1]);
    //(status, backData, backLen) = self.MFRC522_ToCard(self.PCD_TRANSCEIVE, recvData)
    var obj = this.MFRC522_ToCard(this.PCD_TRANSCEIVE, recvData);
    var status = obj.status;
    var backData = obj.backData;
    var backLen = obj.backLen;
    if (!(status == this.MI_OK)) {
      console.log("Error while reading!");
    }
    var i = 0;
    if (backData.length == 16) {
      console.log("Sector "+ blockAddr +" " + backData);
    }
  },
  
  MFRC522_Write: function(blockAddr, writeData) {
    var buff = [];
    buff.push(this.PICC_WRITE);
    buff.push(blockAddr);
    var crc = this.CalulateCRC(buff);
    buff.push(crc[0]);
    buff.push(crc[1]);
    //(status, backData, backLen) = self.MFRC522_ToCard(self.PCD_TRANSCEIVE, buff)
    var obj = this.MFRC522_ToCard(this.PCD_TRANSCEIVE, buff);
    var status = obj.status;
    var backData = obj.backData;
    var backLen = obj.backLen;
    if (!(status == this.MI_OK) || !(backLen == 4) || !((backData[0] & 0x0F) == 0x0A)) {
      status = this.MI_ERR;
    }
    
    console.log(backLen + " backdata &0x0F == 0x0A "+ backData[0]&0x0F);
    if (status == this.MI_OK) {
      var i = 0;
      var buf = [];
      while (i < 16) {
        buf.push(writeData[i]);
        i = i + 1;
      }
      crc = CalulateCRC(buf)
      buf.push(crc[0])
      buf.push(crc[1])
      //(status, backData, backLen) = self.MFRC522_ToCard(self.PCD_TRANSCEIVE,buf)
      var obj = this.MFRC522_ToCard(this.PCD_TRANSCEIVE, buff);
      var status = obj.status;
      var backData = obj.backData;
      var backLen = obj.backLen;
        
      if (!(status == this.MI_OK) || !(backLen == 4) || !((backData[0] & 0x0F) == 0x0A)) {
        console.log("Error while writing");
      }
      if (status == this.MI_OK) {
        console.log("Data written");
      }
    }
  },

  MFRC522_DumpClassic1K: function(key, uid) {
    var i = 0;
    while (i < 64) {
      var status = this.MFRC522_Auth(this.PICC_AUTHENT1A, i, key, uid);
      // Check if authenticated
      if (status == this.MI_OK) {
        this.MFRC522_Read(i);
      }
      else {
        console.log("Authentication error");
      }
      i = i+1;
    }
  },

  MFRC522_Init: function() {
    this.wpi.digitalWrite(this.NRSTPD, this.wpi.HIGH);
  
    this.MFRC522_Reset();
    
    
    this.Write_MFRC522(this.TModeReg,      0x8D)
    this.Write_MFRC522(this.TPrescalerReg, 0x3E)
    this.Write_MFRC522(this.TReloadRegL,   30)
    this.Write_MFRC522(this.TReloadRegH,   0)
    
    this.Write_MFRC522(this.TxAutoReg, 0x40)
    this.Write_MFRC522(this.ModeReg,   0x3D)
    this.AntennaOn()
  }
};

function test() {
  var MIFAREReader = MFRC522;
  MIFAREReader.init();

  //# This loop keeps checking for chips. If one is near it will get the UID and authenticate
  console.log("Test starting ...");
  while(true) {
    
    //# Scan for cards    
    //(status,TagType) = MIFAREReader.MFRC522_Request(MIFAREReader.PICC_REQIDL)
    var obj = MIFAREReader.MFRC522_Request(MIFAREReader.PICC_REQIDL);
    var status = obj.status;
    var TagType = obj.backBits;

    //# If a card is found
    if (status == MIFAREReader.MI_OK) {
      console.log("Card detected");
    }
    
    //# Get the UID of the card
    //(status,uid) = MIFAREReader.MFRC522_Anticoll()
    obj = MIFAREReader.MFRC522_Anticoll();
    status = obj.status;
    var uid = obj.backData;

    //# If we have the UID, continue
    if (status == MIFAREReader.MI_OK) {
      //# Print UID
      console.log("Card read UID: %s %s %s %s", uid[0].toString(16),uid[1].toString(16), uid[2].toString(16), uid[3].toString(16));
    
      //# This is the default key for authentication
      var key = [0xFF,0xFF,0xFF,0xFF,0xFF,0xFF];
        
      //# Select the scanned tag
      MIFAREReader.MFRC522_SelectTag(uid);

      //# Dump the data
      MIFAREReader.MFRC522_DumpClassic1K(key, uid);

      //# Stop
      MIFAREReader.MFRC522_StopCrypto1();
    }
  }
}

test();
