/**
 * Группировка массива по ключу
 * @param array
 * @param keyFn
 * @returns {*}
 */
function groupBy(array, keyFn) {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}
/**
 * Анализ последовательности чисел на устойчивость, возрастание и убывание
 * @param sequence
 * @param tolerance
 * @returns {{isIncreasing: boolean, isDecreasing: boolean, isStable: boolean}}
 */
function analyzeSequence(sequence, tolerance = 0.05) {
  const trends = {
    isStable: true,
    isIncreasing: false,
    isDecreasing: false,
  };

  if (sequence.length < 2) {
    return trends; // Для последовательностей длиной меньше 2 невозможно определить тренды
  }

  const start = sequence[0];
  const end = sequence[sequence.length - 1];
  const totalChange = end - start;

  // Проверяем стабильность: каждое значение должно быть в пределах tolerance от предыдущего
  for (let i = 1; i < sequence.length; i++) {
    const relativeChange =
      Math.abs(sequence[i] - sequence[i - 1]) / Math.abs(sequence[i - 1]);
    if (relativeChange > tolerance) {
      trends.isStable = false;
      break;
    }
  }

  // Проверяем рост и убывание
  trends.isIncreasing = totalChange > 0;
  trends.isDecreasing = totalChange < 0;

  return trends;
}

/**
 * Функция для расчета выручки
 * @param purchase запись о покупке -  одна из записей в поле items из чека в data.purchase_records
 * @param _product карточка товара - продукт из коллекции data.products
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount, sale_price, quantity } = purchase;
  // Расчет выручки от операции
  const discountFactor = 1 - purchase.discount / 100;
  const revenue = purchase.sale_price * purchase.quantity * discountFactor;
  return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  //Расчет бонуса от позиции в рейтинге.
  const { profit } = seller;
  if (index === 0) {
    return profit * 0.15;
  } else if (index === 1 || index === 2) {
    return profit * 0.1;
  } else if (index === total - 1) {
    return 0;
  } else {
    // Для всех остальных
    return profit * 0.05;
  }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  //  Проверка наличия опций
  const { calculateRevenue, calculateBonus } = options; //Сюда передадим функции для расчётов
  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Не переданы необходимые функции для расчёта: calculateRevenue или calculateBonus");
  }
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.purchase_records) ||
    !Array.isArray(data.products) ||
    data.sellers.length === 0 ||
    data.products.length === 0 ||
    data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  // Подготовка промежуточных данных для сбора статистики. Здесь посчитаем промежуточные данные и отсортируем продавцов
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  //  Индексация продавцов и товаров для быстрого доступа
  const sellerIndex = sellerStats.reduce((acc, seller) => {
    acc[seller.id] = seller;
    return acc;
  }, {});
  const productIndex = data.products.reduce((acc, product) => {
    acc[product.sku] = product;
    return acc;
  }, {});

  //Перебор чеков и покупок в них
  data.purchase_records.forEach((record) => {
    // Чек
    const seller = sellerIndex[record.seller_id]; // Продавец
    if (seller) {
      seller.sales_count += 1;
      seller.revenue += record.total_amount;
    }

    // Расчёт прибыли для каждого товара Учёт количества проданных товаров
    record.items.forEach((item) => {
      const product = productIndex[item.sku]; // Товар
      const cost = product.purchase_price * item.quantity; //себест
      const revenue = calculateSimpleRevenue(item); //выручка
      const profit = revenue - cost; //прибыль
      seller.profit += profit;
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // Сортируем продавцов по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  //перебрать массив calculateBonus посчитать бонус
  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sellerStats.length, seller); // Считаем бонус
    const productsArray = Object.entries(seller.products_sold);//массив пар [sku, количество]
    const sortedProducts = productsArray.sort((a, b) => b[1] - a[1]);// Сорт массив по количеству проданных товаров (по убыванию)
    const top10Products = sortedProducts.slice(0, 10);//  топ‑10
    seller.top_products = top10Products;
  });

  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: parseFloat((seller.revenue).toFixed(2)),
    profit: parseFloat((seller.profit).toFixed(2)),
    sales_count: seller.sales_count,
    top_products: seller.top_products.map(([sku, quantity]) => ({
      sku,
      quantity,
    })),
    bonus: parseFloat((seller.bonus).toFixed(2)), // Число с двумя знаками после точки, бонус продавца
  }));

}
