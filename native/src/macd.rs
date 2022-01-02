#![deny(clippy::all)]
use crate::dema::InternalDema;
use crate::ema::InternalEma;
use crate::utils::MaIndicator;
use napi::bindgen_prelude::ToNapiValue;
use std::cell::Cell;

#[napi]
pub enum MacdIndicatorEnum {
  EMA,
  DEMA,
}

#[napi(object)]
pub struct MacdConfig {
  pub long_interval: f64,
  pub short_interval: f64,
  pub signal_interval: f64,
  pub indicator: MacdIndicatorEnum,
}
#[napi(object)]
#[derive(Copy, Clone)]
pub struct MacdResult {
  pub histogram: f64,
  pub macd: f64,
  pub signal: f64,
}

pub struct InternalMacd {
  pub long: Box<dyn MaIndicator>,
  pub short: Box<dyn MaIndicator>,
  pub signal: Box<dyn MaIndicator>,
  pub result: Cell<MacdResult>,
  pub age: Cell<f64>,
  pub initialized: Cell<bool>,
}

fn get_indicator(indicator: MacdIndicatorEnum, interval: f64) -> Box<dyn MaIndicator> {
  if let MacdIndicatorEnum::DEMA = indicator {
    return Box::new(InternalDema::new(interval));
  }
  Box::new(InternalEma::new(interval))
}

impl InternalMacd {
  pub fn new(config: MacdConfig) -> Self {
    Self {
      long: get_indicator(config.indicator, config.long_interval),
      short: get_indicator(config.indicator, config.short_interval),
      signal: get_indicator(config.indicator, config.signal_interval),
      result: Cell::new(MacdResult {
        histogram: 0.0,
        macd: 0.0,
        signal: 0.0,
      }),
      initialized: Cell::new(false),
      age: Cell::new(0.0),
    }
  }
  pub fn update(&self, price: f64) -> MacdResult {
    self.fast_update(price);
    self.result.get()
  }
  pub fn fast_update(&self, price: f64) -> bool {
    let short = self.short.update(price);
    let long = self.long.update(price);
    self.age.set(self.age.get());
    let macd = short - long;
    let signal = if self.is_stable() {
      self.signal.update(macd)
    } else {
      0.0
    };
    let histogram = macd - signal;
    self.result.set(MacdResult {
      histogram,
      macd,
      signal,
    });
    true
  }
  pub fn get_result(&self) -> MacdResult {
    if !self.is_stable() {
      return MacdResult {
        histogram: 0.0,
        macd: 0.0,
        signal: 0.0,
      };
    }
    self.result.get()
  }
  pub fn is_stable(&self) -> bool {
    self.long.is_stable()
  }
}

#[napi(js_name = "MACD")]
pub struct Macd {
  engine: InternalMacd,
}

#[napi]
impl Macd {
  #[napi(constructor)]
  pub fn new(config: MacdConfig) -> Self {
    Self {
      engine: InternalMacd::new(config),
    }
  }
  #[napi]
  pub fn update(&self, price: f64) -> MacdResult {
    self.engine.update(price)
  }
  #[napi]
  pub fn fast_update(&self, price: f64) -> bool {
    self.engine.fast_update(price)
  }
  #[napi]
  pub fn get_result(&self) -> MacdResult {
    self.engine.get_result()
  }
  #[napi(getter)]
  pub fn is_stable(&self) -> bool {
    self.engine.is_stable()
  }
  #[napi(getter)]
  pub fn result(&self) -> MacdResult {
    self.engine.get_result()
  }
}
