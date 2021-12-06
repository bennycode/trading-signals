### 3.2.0 (2021-12-06)

##### New Features

- **DMA:** Add faster implementation ([#375](https://github.com/bennycode/trading-signals/pull/375)) ([c8ddcbde](https://github.com/bennycode/trading-signals/commit/c8ddcbde59293f37247bb8092ddaa63bb7451cea))
- **ADX,DX:** Add faster implementation ([#374](https://github.com/bennycode/trading-signals/pull/374)) ([575c4d4b](https://github.com/bennycode/trading-signals/commit/575c4d4ba7c1b0f413c86052918213d24d29bba4))
- **AC,AO,MOM:** Add faster implementation ([#373](https://github.com/bennycode/trading-signals/pull/373)) ([c821c64b](https://github.com/bennycode/trading-signals/commit/c821c64b63c078e29d28f92d206006a2aa5aeacd))
- **ABANDS:** Add faster implementation ([#372](https://github.com/bennycode/trading-signals/pull/372)) ([74841cbc](https://github.com/bennycode/trading-signals/commit/74841cbc9e6fbb5fef66bf218899c8e4d0514f34))

##### Refactors

- Run faster implementation after original implementation ([1583ed54](https://github.com/bennycode/trading-signals/commit/1583ed549f760b2be0acbea114431ae1a7c028b2))

### 3.1.0 (2021-11-29)

##### New Features

- **STOCHRSI:** Add Stochastic RSI ([#370](https://github.com/bennycode/trading-signals/pull/370)) ([ebc4964c](https://github.com/bennycode/trading-signals/commit/ebc4964c02e4672dc9fb06fa68387c508a097445))
- **BBANDS:** Return values on update ([e3a96c80](https://github.com/bennycode/trading-signals/commit/e3a96c8078c010bda4c1a7c00bf9e1fc0a04b7ec))
- **MAD:** Return values on update ([77e6c36a](https://github.com/bennycode/trading-signals/commit/77e6c36ae1905e718d515cc3a1d93b393d2d2e7f))

## 3.0.0 (2021-11-19)

##### Documentation Changes

- Use reference-style link definition ([#360](https://github.com/bennycode/trading-signals/pull/360)) ([74aa0133](https://github.com/bennycode/trading-signals/commit/74aa0133aba2820bd055839550f6a9233b55f3c7))

##### New Features

- **ATR,WSMA:** Add faster implementations ([#367](https://github.com/bennycode/trading-signals/pull/367)) ([65823cbf](https://github.com/bennycode/trading-signals/commit/65823cbf9ac6677564a580bc0c022c6e0461b416))
- **DX:** Add Directional Movement Index (DX) ([#365](https://github.com/bennycode/trading-signals/pull/365)) ([2c51d7c0](https://github.com/bennycode/trading-signals/commit/2c51d7c0fc35ce3342414b4130edb64d4652e693))
- **TR:** Add True Range (TR) implementation ([#361](https://github.com/bennycode/trading-signals/pull/361)) ([9c4a6d02](https://github.com/bennycode/trading-signals/commit/9c4a6d02bcecdde6dbe5b568c6ec547512164364))

##### Refactors

- **ADX:** Return direct result and +DI & -DI only via getters ([#368](https://github.com/bennycode/trading-signals/pull/368)) ([2c0818fe](https://github.com/bennycode/trading-signals/commit/2c0818fee37038836f8cfc979a791359d7a6f8bd))
- **SMMA,WSMA:** Replaced SMMA with WSMA ([#362](https://github.com/bennycode/trading-signals/pull/362)) ([80a0f2c4](https://github.com/bennycode/trading-signals/commit/80a0f2c4f736cab79d1ee10f8ffe22f03eb7be63))
- Remove "isStable" override ([77901cfb](https://github.com/bennycode/trading-signals/commit/77901cfb07ba1cc96fc39421791359fdb7aeb1e1))

### 2.5.0 (2021-11-12)

##### Documentation Changes

- Map mean to average ([2ef901cc](https://github.com/bennycode/trading-signals/commit/2ef901cc06dbb659f54986f5cda3a3ab2863c480))

##### New Features

- **CCI:** Add faster CCI implementation ([#356](https://github.com/bennycode/trading-signals/pull/356)) ([f90e95b6](https://github.com/bennycode/trading-signals/commit/f90e95b69dd207eb6bc0c43e67c804fabb7a6677))
- **CCI,MAD:** Add Commodity Channel Index (CCI) & Mean Absolute Deviation (MAD) ([#355](https://github.com/bennycode/trading-signals/pull/355)) ([754398f3](https://github.com/bennycode/trading-signals/commit/754398f3f94d364d138a84d955602add83ecea5b))

#### 2.4.1 (2021-11-07)

##### Documentation Changes

- Describe faster implementations ([#354](https://github.com/bennycode/trading-signals/pull/354)) ([a61afe61](https://github.com/bennycode/trading-signals/commit/a61afe61be50f9adc443eaf6011e550dba168a9d))

##### New Features

- **ci:** Automatically add GitHub labels to PRs ([#349](https://github.com/bennycode/trading-signals/pull/349)) ([35c976d3](https://github.com/bennycode/trading-signals/commit/35c976d39b557cfdba50ce076ac9a576eb6ecaf6))
- **EMA:** Add faster EMA implementation ([#348](https://github.com/bennycode/trading-signals/pull/348)) ([98d8ad72](https://github.com/bennycode/trading-signals/commit/98d8ad72587e4aafda29f5f36fb3118bdc62cc36))

##### Refactors

- Simplify indicator interfaces ([#351](https://github.com/bennycode/trading-signals/pull/351)) ([992eeefe](https://github.com/bennycode/trading-signals/commit/992eeefeb36817341e4ec75519783dd09892fcd6))

### 2.4.0 (2021-10-24)

##### Documentation Changes

- Explain `update` & `getResult` ([f2a0e745](https://github.com/bennycode/trading-signals/commit/f2a0e745f5ba4aba7f60d027ec7a7d44019c8478))

##### New Features

- **BBANDS:** Add faster Bollinger Bands implementation based on numbers ([#338](https://github.com/bennycode/trading-signals/pull/338)) ([d262dad4](https://github.com/bennycode/trading-signals/commit/d262dad415644394c5e738503c6885569d12cd3a))
- Add Standard Deviation ([#337](https://github.com/bennycode/trading-signals/pull/337)) ([b89dbcdc](https://github.com/bennycode/trading-signals/commit/b89dbcdccf1df46086f358345bcd0182e4aef0e9))
- **util:** Add faster average implementation based on numbers ([2029f1c3](https://github.com/bennycode/trading-signals/commit/2029f1c3ec72831de9a8578e3e23d0143d167168))
- **SMA:** Add faster SMA implementation based on numbers ([#336](https://github.com/bennycode/trading-signals/pull/336)) ([ea918088](https://github.com/bennycode/trading-signals/commit/ea918088894850b64bde8221581a5587d97c6a3b))

##### Other Changes

- bennycode/trading-signals into main ([c8120128](https://github.com/bennycode/trading-signals/commit/c8120128ac93ff74ea7075aefe183c749b7a92da))

##### Refactors

- **util:** Change faster prefix ([d4894377](https://github.com/bennycode/trading-signals/commit/d4894377832726c94add3b6a5e6364f77f6b9fad))
- **SMA:**
  - Export FasterSMA from SMA directory ([cfe98337](https://github.com/bennycode/trading-signals/commit/cfe983372e1155dfd652b1951705b728de00cc38))
  - Re-use static `getResultFromBatch` method ([89e08a6a](https://github.com/bennycode/trading-signals/commit/89e08a6a9a0cc699951122dca7285c2a2da98402))
- **EMA:** Calculate weight factor only once ([80b368f1](https://github.com/bennycode/trading-signals/commit/80b368f19b030c6823159cc5062d109bae5ce478))

### 2.3.0 (2021-09-05)

##### Documentation Changes

- Specify technical indicator types ([#316](https://github.com/bennycode/trading-signals/pull/316)) ([edff17ef](https://github.com/bennycode/trading-signals/commit/edff17ef6db556565635b0c6e324fc1dde1399ea))
- Add Technical Analysis Library using Pandas ([7cf77846](https://github.com/bennycode/trading-signals/commit/7cf7784610378c2c5e68815d41312d99cefe0330))
- Add Technical Analysis Library using Pandas ([26baa759](https://github.com/bennycode/trading-signals/commit/26baa75960b8d44191df75aacdb0390f4a5d9b1f))

##### New Features

- **STOCH:** Add Stochastic Oscillator ([#314](https://github.com/bennycode/trading-signals/pull/314)) ([6d13ca6a](https://github.com/bennycode/trading-signals/commit/6d13ca6a6702d21cf7837fa9e919759c2da504dd))
- **WSMA:** Add Wilder's Smoothed Moving Average (WSMA) ([#313](https://github.com/bennycode/trading-signals/pull/313)) ([a9a94343](https://github.com/bennycode/trading-signals/commit/a9a943439f66c643adc7a83b2f94a5505d07a7ad))
- **ADX,ATR,RSI:** Add option to use EMA or SMA for smoothing results ([#312](https://github.com/bennycode/trading-signals/pull/312)) ([c75f34e7](https://github.com/bennycode/trading-signals/commit/c75f34e7673d7462e4de1c58d92a8e524593269a))

##### Refactors

- **ADX,ATR,STOCH:** Share high low close type ([e3d677f5](https://github.com/bennycode/trading-signals/commit/e3d677f527c6eaeadbcb2f6626402484ca74b43c))
- **ABANDS,BBANDS:** Reorganize source code files ([300b4413](https://github.com/bennycode/trading-signals/commit/300b441382bf71e5eaf9bcfb5245960ac1c5dc67))

### 2.2.0 (2021-08-29)

##### New Features

- Export `SimpleIndicator` & `Indicator` interface ([2e7e5447](https://github.com/bennycode/trading-signals/commit/2e7e5447125376c93b0a81c2d546b5f1debe1879))

### 2.1.0 (2021-08-28)

##### New Features

- **EMA,DEMA,MACD:** Don't emit values before minimum amount of data is received ([#308](https://github.com/bennycode/trading-signals/pull/308)) ([9074514c](https://github.com/bennycode/trading-signals/commit/9074514ce9d7e40b8d772817255ddff5aed40d0c))

##### Refactors

- Mark overridden functions ([ad94144b](https://github.com/bennycode/trading-signals/commit/ad94144bf5c07fc1a9123cac5eac7a35ac12437b))

#### 2.0.1 (2021-08-28)

##### New Features

- **util:** Export utilities ([bb59af17](https://github.com/bennycode/trading-signals/commit/bb59af17e9443a3b089eb777e7467a1ff31a4465))

##### Bug Fixes

- **SMMA,RSI,ATR,ADX:** Don't cache more prices than necessary to fill the interval ([#307](https://github.com/bennycode/trading-signals/pull/307)) ([2bb0a638](https://github.com/bennycode/trading-signals/commit/2bb0a638e84ea605526d9314f8887609e486f7eb))

## 2.0.0 (2021-08-15)

##### New Features

- **AC,AO,ATR,CG,DEMA,EMA,MOM,ROC,RSI,SMA,SMMA:** Save highest & lowest values for all simple indicators ([#295](https://github.com/bennycode/trading-signals/pull/295)) ([7c6433be](https://github.com/bennycode/trading-signals/commit/7c6433be075994d2b21fb9f02ae462bf257d825e))

#### 1.10.2 (2021-08-12)

##### New Features

- **AC,AO:** Directly return result on update ([1ea3efe4](https://github.com/bennycode/trading-signals/commit/1ea3efe45d29a0fc3ea6c3791127185c85d89e29))

#### 1.10.1 (2021-08-05)

##### Refactors

- **AC,AO:** Expose internal indicators ([71273704](https://github.com/bennycode/trading-signals/commit/71273704fcd878a2a82c3346c9ee5e3a541c0390))

### 1.10.0 (2021-08-05)

##### New Features

- Add Momentum to Accelerator Oscillator ([#290](https://github.com/bennycode/trading-signals/pull/290)) ([ae9bc24e](https://github.com/bennycode/trading-signals/commit/ae9bc24eb318e0bdad7c64c1d54a5ca28e0885c7))
- Add Momentum (MOM) ([#289](https://github.com/bennycode/trading-signals/pull/289)) ([eea7899f](https://github.com/bennycode/trading-signals/commit/eea7899ff9eb78b2b7a70fd068570ff0f0bcc331))
- Add Accelerator Oscillator (AC) ([#288](https://github.com/bennycode/trading-signals/pull/288)) ([2fd93c20](https://github.com/bennycode/trading-signals/commit/2fd93c204454c6051371799ea759fe573b50d9b1))

##### Refactors

- **util:** Export `getAverage` separately ([6f4a1c58](https://github.com/bennycode/trading-signals/commit/6f4a1c58d63d34b51cd41967f75dd8bf416ae962))

### 1.9.0 (2021-08-04)

##### New Features

- Add Awesome Oscillator (AO) ([#287](https://github.com/bennycode/trading-signals/pull/287)) ([2dcba835](https://github.com/bennycode/trading-signals/commit/2dcba835b4f873848cefc034cab3e21348c51046))

### 1.8.0 (2021-07-20)

### 1.7.0 (2021-06-11)

##### New Features

- **ADX:** Return directional indicators (+DI & -DI) ([458466fe](https://github.com/bennycode/trading-signals/commit/458466fe51109c5bd9742e51da6b1bf6abd419e9))

#### 1.6.1 (2021-04-17)

##### Bug Fixes

- **macd:** Ensure MACD histogram compatibility with Tulip Indicators ([#219](https://github.com/bennycode/trading-signals/pull/219)) ([3e27d4e9](https://github.com/bennycode/trading-signals/commit/3e27d4e9caf2f8d4a43851158f57527439ae2f09))

### 1.6.0 (2021-02-16)

##### New Features

- Add Center of Gravity (CG) oscillator ([#185](https://github.com/bennycode/trading-signals/pull/185)) ([f5aa6137](https://github.com/bennycode/trading-signals/commit/f5aa6137b8d2186443c2e4ea9e77661fc9e2b7e8))
- **ADX:** Make interval public ([81351743](https://github.com/bennycode/trading-signals/commit/813517436ed8845769f097ef5ed55af651d84093))

#### 1.5.1 (2021-02-08)

### 1.5.0 (2021-02-08)

##### New Features

- Expose read-only intervals ([f849a8c5](https://github.com/bennycode/trading-signals/commit/f849a8c5c01f1f2c25833b9425040f8b52e2dffd))

### 1.4.0 (2021-02-06)

##### New Features

- Add Acceleration Bands (ABANDS) indicator ([#175](https://github.com/bennycode/trading-signals/pull/175)) ([67d1d881](https://github.com/bennycode/trading-signals/commit/67d1d8813cae2a9d6ea9b92926cc9114cc0d50b4))

### 1.3.0 (2021-01-31)

##### Bug Fixes

- Align MACD results with Tulip Indicators ([#171](https://github.com/bennycode/trading-signals/pull/171)) ([5923be10](https://github.com/bennycode/trading-signals/commit/5923be1078fb2c4964785d36fdf1d26096c19ac6))

#### 1.2.1 (2020-12-09)

##### Bug Fixes

- Check long interval when using moving average crossover with EMA ([#142](https://github.com/bennycode/trading-signals/pull/142)) ([4c218a9e](https://github.com/bennycode/trading-signals/commit/4c218a9e467dca41dd3579ed30ab55bbb2765f6e))

### 1.2.0 (2020-11-05)

##### New Features

- Add option to use EMA for DMA calculation ([#116](https://github.com/bennycode/trading-signals/pull/116)) ([90323796](https://github.com/bennycode/trading-signals/commit/90323796cc94604b6a84b5deb9f620d9e0d4b33b))

#### 1.1.1 (2020-09-06)

### 1.1.0 (2020-09-04)

##### New Features

- Add option to use EMA for RSI calculation ([#70](https://github.com/bennycode/trading-signals/pull/70)) ([33b7b750](https://github.com/bennycode/trading-signals/commit/33b7b750c387926fa551b6ee86fc2fe64b29360e))

#### 1.0.1 (2020-06-15)

## 1.0.0 (2020-06-03)

##### New Features

- Add Average Directional Index (ADX) indicator ([#14](https://github.com/bennycode/trading-signals/pull/14)) ([1a21d531](https://github.com/bennycode/trading-signals/commit/1a21d531519d4a5c61d0eb51ab89651319b412f4))
- Add `isStable` to DMA indicator ([5f1f9dcb](https://github.com/bennycode/trading-signals/commit/5f1f9dcb30f2e4238d54db5f542c8534c9a66294))

### 0.4.0 (2020-06-01)

##### New Features

- Add Average True Range (ATR) indicator ([#13](https://github.com/bennycode/trading-signals/pull/13)) ([e6f88ea8](https://github.com/bennycode/trading-signals/commit/e6f88ea8f3d39d3679b57dff842b4f35c01c9749))

### 0.2.0 (2020-06-01)

### 0.1.0 (2020-05-31)

##### New Features

- Add Moving Average Convergence Divergence (MACD) indicator ([#7](https://github.com/bennycode/trading-signals/pull/7)) ([38a645de](https://github.com/bennycode/trading-signals/commit/38a645de45db1fb2e072c4dfb9df9a124600ef9a))

#### 0.0.5 (2020-05-30)

##### New Features

- Add Rate-of-Change (ROC) indicator ([#4](https://github.com/bennycode/trading-signals/pull/4)) ([f02b5efe](https://github.com/bennycode/trading-signals/commit/f02b5efe061220fa73c1300c6fd88ede4b0e211c))

#### 0.0.4 (2020-05-30)

##### New Features

- Add Relative Strength Index (RSI) ([#3](https://github.com/bennycode/trading-signals/pull/3)) ([f49f897c](https://github.com/bennycode/trading-signals/commit/f49f897cd3ce718b7ab17c4777e8d47d82219c4d))
- Accept input of type number, string & Big ([13aaa996](https://github.com/bennycode/trading-signals/commit/13aaa9965ba51a21d91da055e4e379d900f19dff))

#### 0.0.2 (2020-05-28)

##### Other Changes

- SMA & EMA ([#1](https://github.com/bennycode/trading-signals/pull/1)) ([820842d6](https://github.com/bennycode/trading-signals/commit/820842d62d5bbe20991b0c2742f6f9d7aafff66d))

#### 0.0.1 (2020-05-28)

#### 0.0.2 (2020-05-28)

#### 0.0.1 (2020-05-28)

##### Other Changes

- SMA & EMA ([#1](https://github.com/bennycode/trading-signals/pull/1)) ([820842d6](https://github.com/bennycode/trading-signals/commit/820842d62d5bbe20991b0c2742f6f9d7aafff66d))

#### 0.0.1 (2020-05-28)

##### Other Changes

- SMA & EMA ([#1](https://github.com/bennycode/trading-signals/pull/1)) ([820842d6](https://github.com/bennycode/trading-signals/commit/820842d62d5bbe20991b0c2742f6f9d7aafff66d))
