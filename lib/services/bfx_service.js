const BFX = require('bitfinex-api-node');
const EventEmitter = require('events');

class BFXSevice extends EventEmitter {
  constructor(symbols = [], logger = console) {
    super();
    this.symbols = symbols;
    this.logger = logger;
    this.client = null;
  }

  formatSymbol(symbol) {
    return symbol.substring(0, 1) === 't'
      ? symbol.substring(1)
      : symbol;
  }

  start() {
    const opts = {
      version: 2,
      transform: true,
    };
    const ws = new BFX(opts).ws();
    this.client = ws;

    ws.on('error', (err) => {
      this.logger.error(`Bitfinex: error: ${JSON.stringify(err)}`);
    });

    ws.on('close', () => {
      this.logger.error('Bitfinex: Connection closed');
      ws.open(); // Reopen the socket
    });

    ws.on('open', () => {
      this.logger.debug('Bitfinex: Connection open');

      // Subscribe to all symbols
      this.symbols.forEach((symbol) => {
        // Ticker subscribe
        ws.subscribeTicker(`t${symbol}`);
        // Candle subscribe
        ws.subscribeCandles(`trade:1m:t${symbol}`);
      });
    });

    ws.on('ticker', this.onTicker.bind(this));

    ws.on('candle', this.onCandles.bind(this));

    ws.open();
  }

  onTicker(pair, ticker) {
    const symbol = this.formatSymbol(pair);

    this.emit('ticker', {
      symbol,
      prices: {
        bid: ticker.bid,
        ask: ticker.ask
      }
    });
  }

  onCandles(candles, pair) {
    const options = pair.split(':');
    const symbol = this.formatSymbol(options[2]);
    const myCandles = [];

    if(Array.isArray(candles)) {
      // Reverse candles as oldest candle must given first
      candles
        .reverse()
        .forEach((candle) => {
          myCandles.push(candle);
        });
    } else {
      myCandles.push(candles);
    }

    const sticks = myCandles
      .filter(candle => (typeof candle.mts !== 'undefined'))
      .map(candle => ({ symbol, candle }));

    if(sticks.length === 0) {
      this.logger.error(`Candle issue: ${pair}`);
      return;
    }

    this.emit('candles', sticks);
  }
}

module.exports = BFXSevice;
