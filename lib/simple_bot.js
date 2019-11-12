const ti = require('technicalindicators');
const BFXService = require('./services/bfx_service');

ti.setConfig('precision', 8);
const { EMA, SMA } = ti;

class SimpleBot {
  // A simple bot which supports multiple trading symbols of USD market
  // TODO: Support all markets, integrate with user account, real ordering api

  /**
   * @constructs SimpleBot Instantiate the class
   * @param {Array} symbols - Trading symbols
   * @param {Number} maxSpendInUSD - Maximum trade amount in one order
   * @param {*} logger - Logger util
   * @example
   * const bot = new SimpleBot()
   */
  constructor(symbols = ['BTCUSD'], maxSpendInUSD = 1000, logger = console) {
    this.symbols = symbols;
    this.maxSpendInUSD = maxSpendInUSD;
    this.logger = logger;

    this.bfxService = new BFXService(symbols);
    this.candles = {};
    this.tickers = {};
    this.myOrders = [];
  }

  /**
   * @description Returns current order history of all symbols
   * @example
   * bot.getOrderHistory()
   */
  getOrderHistory() {
    return this.myOrders;
  }

  /**
   * @description Returns candle data merged by symbols
   * @example
   * bot.getCandles()
   */
  getCandles() {
    return this.candles;
  }

  /**
   * @description Returns bid and ask status of all symbols
   * @example
   * bot.getTickers()
   */
  getTickers() {
    return this.tickers;
  }

  /**
   * @description Returns current PoL status based on the last close price.
   * @example
   * bot.getCurrentPoL()
   */
  getCurrentPoL() {
    let value = 0;
    this.myOrders.forEach(({ symbol, signal, price, amount }) => {
      if(this.candles[symbol]) {
        const candles = this.candles[symbol];
        const lastClose = candles[candles.length - 1].close;
        const change = (signal === 'buy' ? 1 : -1) * (lastClose - price) * amount;
        value += change;
      }
    });
    return value;
  }

  /**
   * @description Format candles data to pass into technical indicator
   * @param {Array<Object>} candles - Array of candles
   */
  formatCandles(candles = []) {
    const format = {
      open: [],
      close: [],
      high: [],
      low: [],
      vol: [],
    };

    candles.forEach((candle) => {
      format.open.push(candle.open);
      format.close.push(candle.close);
      format.high.push(candle.high);
      format.low.push(candle.low);
      format.vol.push(candle.vol);
    });

    return format;
  }

  /**
   * @description Calculate the signal using EMA indicator
   * @param {Array<number>} values - Array of prices
   * @returns {String} Return one of ['buy', 'sell', 'neutral']
   */
  ema(values = []) {
    if(!values.length) {
      return 'unknown';
    }

    const lastPrice = values[values.length - 1];

    let buy = 0;
    let sell = 0;

    const periods = [5, 10, 20];

    periods.forEach((period) => {
      const ma = EMA.calculate({ period, values });
      const maCurrent = ma[ma.length - 1];

      if(maCurrent > lastPrice) {
        sell += 1;
      } else if(maCurrent < lastPrice) {
        buy += 1;
      }
    });

    if(buy === periods.length) {
      return 'buy';
    }
    if(sell === periods.length) {
      return 'sell';
    }
    return 'neutral';
  }

  /**
   * @description Calculate the signal using SMA indicator
   * @param {Array<number>} values - Array of prices
   * @returns {String} Return one of ['buy', 'sell', 'neutral']
   */
  sma(values = []) {
    if(!values.length) {
      return 'unknown';
    }

    const lastPrice = values[values.length - 1];

    let buy = 0;
    let sell = 0;

    const periods = [5, 10, 20];

    periods.forEach((period) => {
      const ma = SMA.calculate({ period, values });
      const maCurrent = ma[ma.length - 1];

      if(maCurrent > lastPrice) {
        sell += 1;
      } else if(maCurrent < lastPrice) {
        buy += 1;
      }
    });

    if(buy === periods.length) {
      return 'buy';
    }
    if(sell === periods.length) {
      return 'sell';
    }
    return 'neutral';
  }

  /**
   * @description Calculate the signal using SMA and EMA indicator
   * @param {Array<number>} values - Array of prices
   * @returns {String} Return one of ['buy', 'sell', 'neutral']
   */
  signal(values) {
    const emaResult = this.ema(values);
    const smaResult = this.sma(values);

    this.logger.debug(`EMA Result: ${emaResult}, SMA Result: ${smaResult}`);

    if(emaResult === 'buy' && smaResult === 'buy') {
      return 'buy';
    }

    if(emaResult === 'sell' && smaResult === 'sell') {
      return 'sell';
    }

    return 'neutral';
  }

  /**
   * @description Place a new order
   * @param {String} symbol - Market symbol
   * @param {'buy' | 'sell'} signal - One of ['buy', 'sell']
   * @param {String} price - Price of the order
   * @param {String} amount - Amount of the order
   */
  placeOrder(symbol, signal, price, amount) {
    const order = {
      symbol,
      signal,
      price,
      amount,
      timestamp: Date.now()
    };
    this.myOrders.push(order);
    this.logger.debug(`Place Order: ${JSON.stringify(order)}`);
  }

  /**
   * @description Check the given market and make order
   * @param {String} symbol - Market symbol to check
   */
  checkTrade(symbol) {
    if(this.tickers[symbol] && this.candles[symbol]) {
      this.logger.debug('------- Check Trade -------');
      const candles = this.formatCandles(this.candles[symbol]);
      const signal = this.signal(candles.close);

      this.logger.debug('New Signal: ', signal);

      if(signal === 'buy' || signal === 'sell') {
        const price = candles.close[candles.close.length - 1];
        const amountUSD = Math.random() * this.maxSpendInUSD;
        const amount = amountUSD / price;

        this.placeOrder(symbol, signal, price, amount.toFixed(8));
        this.logger.debug(`Current PoL: ${this.getCurrentPoL()}`);
      } else {
        this.logger.debug(`Current PoL: ${this.getCurrentPoL()}`);
      }
    }
  }

  /**
   * @description Event listener to update current candles data
   */
  onUpdateCandles(candles) {
    const updatedSymbols = {};

    // Merge by symbol and calculate updated symbols
    candles.forEach(({ symbol, candle }) => {
      updatedSymbols[symbol] = true;
      this.candles[symbol] = this.candles[symbol] || [];
      this.candles[symbol].push(candle);
    });

    // Check trade for updated symbols
    Object.keys(updatedSymbols).forEach((symbol) => {
      this.checkTrade(symbol);
    });
  }

  /**
   * @description Event listener to update current tickers status
   */
  onUpdateTickers({ symbol, prices }) {
    this.tickers[symbol] = prices;
  }

  /**
   * @description Start trading bot
   * @example
   * bot.start()
   */
  start() {
    // Add event listeners
    this.bfxService.on('ticker', this.onUpdateTickers.bind(this));
    this.bfxService.on('candles', this.onUpdateCandles.bind(this));

    this.bfxService.start();

    this.logger.debug('------------ Simple Bot Started --------------');
  }
}

module.exports = SimpleBot;
