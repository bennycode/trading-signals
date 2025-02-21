[trading-signals](../README.md) / [Exports](../modules.md) / LINREGResult

# Interface: LINREGResult

Results returned by the Linear Regression (LINREG) indicator calculations.

## Properties

### slope

• **slope**: `Big`

The slope of the regression line, representing the average rate of change

---

### intercept

• **intercept**: `Big`

The y-intercept of the regression line, representing the base level

---

### rSquared

• **rSquared**: `Big`

The R-squared value (coefficient of determination), indicating how well the regression line fits the data (0-1)

---

### standardError

• **standardError**: `Big`

The standard error of the regression, measuring the average distance between the data points and the regression line

---

### meanX

• **meanX**: `Big`

The mean of the x values (time periods)

---

### meanY

• **meanY**: `Big`

The mean of the y values (prices)

---

### confidenceInterval

• **confidenceInterval**: `Object`

Confidence intervals for the regression parameters

#### Type declaration

| Name        | Type           | Description                                                     |
| :---------- | :------------- | :-------------------------------------------------------------- |
| `slope`     | [`Big`, `Big`] | The lower and upper bounds of the slope confidence interval     |
| `intercept` | [`Big`, `Big`] | The lower and upper bounds of the intercept confidence interval |
