#![deny(clippy::all)]
use std::cell::Cell;

pub fn set_result(
  value: f64,
  result: &Cell<f64>,
  highest: &Cell<f64>,
  lowest: &Cell<f64>,
  initialized: &Cell<bool>,
) -> bool {
  if !initialized.get() {
    highest.set(value);
    lowest.set(value);
    initialized.set(true);
    return true;
  }
  if value > highest.get() {
    highest.set(value);
  }
  if value < lowest.get() {
    lowest.set(value);
  }
  result.set(value);
  true
}

pub trait MaIndicator {
  fn new(interval: f64) -> Self
  where
    Self: Sized;
  fn get_result(&self) -> f64;
  fn update(&self, price: f64) -> f64;
  fn is_stable(&self) -> bool;
}
