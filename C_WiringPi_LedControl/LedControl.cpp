#include <wiringPi.h>
#include <wiringPiSPI.h>
#include <math.h>
#include <stdio.h>
#include "LedControl.h"

//the opcodes for the MAX7221 and MAX7219
#define OP_NOOP   0
#define OP_DIGIT0 1
#define OP_DIGIT1 2
#define OP_DIGIT2 3
#define OP_DIGIT3 4
#define OP_DIGIT4 5
#define OP_DIGIT5 6
#define OP_DIGIT6 7
#define OP_DIGIT7 8
#define OP_DECODEMODE  9
#define OP_INTENSITY   10
#define OP_SCANLIMIT   11
#define OP_SHUTDOWN    12
#define OP_DISPLAYTEST 15

static int CS_PIN;

LedControl::LedControl(int csPin, int numDevices) {
  wiringPiSetupGpio();
  CS_PIN = csPin;
  pinMode(CS_PIN, OUTPUT);
  digitalWrite(CS_PIN, HIGH);
    if(numDevices<=0 || numDevices>8 )
        numDevices=8;
    maxDevices=numDevices;
    for(int i=0;i<64;i++) {
        status[i]=0x00;
    }
    wiringPiSPISetup(0, 1000000);
    for(int i=0;i<maxDevices;i++) {
        spiTransfer(i,OP_DISPLAYTEST,0);
        //scanlimit is set to max on startup
        setScanLimit(i,7);
        //decode is done in source
        spiTransfer(i,OP_DECODEMODE,0);
        clearDisplay(i);
        //we go into shutdown-mode on startup
        shutdown(i,true);
    }
}

int LedControl::getDeviceCount() {
    return maxDevices;
}

void LedControl::shutdown(int addr, bool b) {
    if(addr<0 || addr>=maxDevices)
        return;
    if(b)
        spiTransfer(addr, OP_SHUTDOWN,0);
    else
        spiTransfer(addr, OP_SHUTDOWN,1);
}

void LedControl::setScanLimit(int addr, int limit) {
    if(addr<0 || addr>=maxDevices)
        return;
    if(limit>=0 && limit<8)
        spiTransfer(addr, OP_SCANLIMIT,limit);
}

void LedControl::setIntensity(int addr, int intensity) {
    if(addr<0 || addr>=maxDevices)
        return;
    if(intensity>=0 && intensity<16)
        spiTransfer(addr, OP_INTENSITY,intensity);
}

void LedControl::clearDisplay(int addr) {
    int offset;

    if(addr<0 || addr>=maxDevices)
        return;
    offset=addr*8;
    for(int i=0;i<8;i++) {
        status[offset+i]=0;
        spiTransfer(addr, i+1,status[offset+i]);
    }
}

void LedControl::setLed(int addr, int row, int column, bool state) {
    int offset;
    uint8_t val=0x00;

    if(addr<0 || addr>=maxDevices)
        return;
    if(row<0 || row>7 || column<0 || column>7)
        return;
    offset=addr*8;
    val=0b10000000 >> column;
    if(state)
        status[offset+row]=status[offset+row]|val;
    else {
        val=~val;
        status[offset+row]=status[offset+row]&val;
    }
    spiTransfer(addr, row+1,status[offset+row]);
}

void LedControl::setRow(int addr, int row, uint8_t value) {
    int offset;
    if(addr<0 || addr>=maxDevices)
        return;
    if(row<0 || row>7)
        return;
    offset=addr*8;
    status[offset+row]=value;
    spiTransfer(addr, row+1,status[offset+row]);
}

void LedControl::setColumn(int addr, int col, uint8_t value) {
    uint8_t val;

    if(addr<0 || addr>=maxDevices)
        return;
    if(col<0 || col>7)
        return;
    for(int row=0;row<8;row++) {
        val=value >> (7-row);
        val=val & 0x01;
        setLed(addr,row,col,val);
    }
}

void LedControl::setDigit(int addr, int digit, uint8_t value, bool dp) {
  printf("Set digit: digit=%d, value=%d\n", digit, value);
    int offset;
    uint8_t v;

    if(addr<0 || addr>=maxDevices)
        return;
    if(digit<0 || digit>7 || value>15)
        return;
    offset=addr*8;
    v=*(charTable + value);
    if(dp)
        v|=0b10000000;
    status[offset+digit]=v;
    spiTransfer(addr, digit+1,v);
}

void LedControl::setChar(int addr, int digit, char value, bool dp) {
    int offset;
    uint8_t index,v;

    if(addr<0 || addr>=maxDevices)
        return;
    if(digit<0 || digit>7)
        return;
    offset=addr*8;
    index=(uint8_t)value;
    if(index >127) {
        //no defined beyond index 127, so we use the space char
        index=32;
    }
    v=*(charTable + index);
    if(dp)
        v|=0b10000000;
    status[offset+digit]=v;
    spiTransfer(addr, digit+1,v);
}

void LedControl::spiTransfer(int addr, volatile uint8_t opcode, volatile uint8_t data) {
    //Create an array with the data to shift out
    int offset=addr*2;
    int maxbytes=maxDevices*2;

    for(int i=0;i<maxbytes;i++) {
        spidata[i]=(uint8_t)0;
    }
    //put our device data into the array
    spidata[offset+1]=opcode;
    spidata[offset]=data;
    //enable the line


    digitalWrite(CS_PIN, LOW);
    //Now shift out the data
    for(int i=maxbytes;i>0;i--) {
      wiringPiSPIDataRW(0, &spidata[i-1], 1);
    }
    //latch the data onto the display
    digitalWrite(CS_PIN, HIGH);

}

void LedControl::setNumber(int addr, double num, int numDecimals) {
  int digit=0;
  double wholeDouble;
  int needPoint = 0;
  int fraction = modf(num, &wholeDouble) * pow(10, numDecimals);
  int whole = wholeDouble;
  if (numDecimals > 0) {
    int i;
    for (i=0; i<numDecimals; i++) {
      setDigit(addr, digit, fraction%10, 0);
      digit++;
      fraction = fraction / 10;
    }
    needPoint = 1;
  }
  while(whole > 0 || digit == 0) {
    setDigit(addr, digit, whole%10, needPoint);
    needPoint = 0;
    digit++;
    whole = whole / 10;
  }
}
