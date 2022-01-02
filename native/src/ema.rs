#![deny(clippy::all)]
use crate::utils::MaIndicator;
use std::cell::Cell;

pub struct InternalEma {
  pub prices_counter: Cell<f64>,
  pub weight_factor: f64,
  pub result: Cell<f64>,
  pub interval: f64,
  pub initialized: Cell<bool>,
}

impl MaIndicator for InternalEma {
  fn new(interval: f64) -> Self {
    Self {
      prices_counter: Cell::new(0.0),
      weight_factor: (2.0 / (interval + 1.0)),
      result: Cell::new(0.0),
      initialized: Cell::new(false),
      interval,
    }
  }
  fn update(&self, price: f64) -> f64 {
    self.prices_counter.set(self.prices_counter.get() + 1.0);
    if !self.initialized.get() {
      self.result.set(price);
      self.initialized.set(true);
    }
    let result = price * self.weight_factor + self.result.get() * (1.0 - self.weight_factor);
    self.result.set(result);
    result
  }
  fn get_result(&self) -> f64 {
    if !self.is_stable() {
      return 0.0;
    }
    self.result.get()
  }
  fn is_stable(&self) -> bool {
    self.prices_counter.get() >= self.interval
  }
}

#[napi(js_name = "EMA")]
pub struct Ema {
  engine: InternalEma,
}

#[napi]
impl Ema {
  #[napi(constructor)]
  pub fn new(interval: f64) -> Self {
    Self {
      engine: InternalEma::new(interval),
    }
  }
  #[napi]
  pub fn update(&self, price: f64) -> f64 {
    self.engine.update(price)
  }
  #[napi]
  pub fn get_result(&self) -> f64 {
    self.engine.get_result()
  }
  #[napi(getter)]
  pub fn is_stable(&self) -> bool {
    self.engine.is_stable()
  }
  #[napi(getter)]
  pub fn result(&self) -> f64 {
    self.engine.get_result()
  }
}
