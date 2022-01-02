#![deny(clippy::all)]
use crate::ema::InternalEma;
use crate::utils::set_result;
use crate::utils::MaIndicator;
use std::cell::Cell;

pub struct InternalDema {
  pub inner: InternalEma,
  pub outer: InternalEma,
  pub result: Cell<f64>,
  pub lowest: Cell<f64>,
  pub highest: Cell<f64>,
  pub initialized: Cell<bool>,
  pub interval: f64,
}

impl MaIndicator for InternalDema {
  fn new(interval: f64) -> Self {
    Self {
      inner: InternalEma::new(interval),
      outer: InternalEma::new(interval),
      highest: Cell::new(0.0),
      lowest: Cell::new(0.0),
      result: Cell::new(0.0),
      initialized: Cell::new(false),
      interval,
    }
  }
  fn update(&self, price: f64) -> f64 {
    let inner = self.inner.update(price);
    let outer = self.outer.update(inner);
    let result = inner * 2.0 - outer;
    set_result(
      result,
      &self.result,
      &self.highest,
      &self.lowest,
      &self.initialized,
    );
    self.result.get()
  }
  fn get_result(&self) -> f64 {
    if !self.is_stable() {
      return 0.0;
    }
    self.result.get()
  }
  fn is_stable(&self) -> bool {
    self.outer.is_stable()
  }
}

#[napi(js_name = "DEMA")]
pub struct Dema {
  engine: InternalDema,
}

#[napi]
impl Dema {
  #[napi(constructor)]
  pub fn new(interval: f64) -> Self {
    Self {
      engine: InternalDema::new(interval),
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
  #[napi(getter)]
  pub fn lowest(&self) -> f64 {
    self.engine.lowest.get()
  }
  #[napi(getter)]
  pub fn highest(&self) -> f64 {
    self.engine.highest.get()
  }
}
