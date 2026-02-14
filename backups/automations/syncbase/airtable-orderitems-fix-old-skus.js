// Airtable Automation Script - Fix Old SKUs (Single Record)
// Trigger: Scheduled automation
// Action 1: Find records (CP OrderItems where Products is empty AND Variants is empty AND SKU is not empty)
// Action 2: Repeating group - Run this script for each record
// Input: orderItemRecordId from the repeating group

// This script processes ONE CP OrderItem record at a time.
// It uses a hardcoded mapping of old SKUs to Product ID, Variant ID, and Price.

// Get the input configuration
let inputConfig = input.config();
let orderItemRecordId = inputConfig.orderItemRecordId;

// Define table references
let cpOrderItemsTable = base.getTable("CP OrderItems");
let productsTable = base.getTable("Products");
let variantsTable = base.getTable("Variants");

// Hardcoded SKU mapping: SKU -> {productId, variantId, price}
const SKU_MAPPING = {
    "1466136": { productId: "9677986496805", variantId: "49889638088997", price: 200.00 },
    "1466167": { productId: "9677986496805", variantId: "49889638088997", price: 300.00 },
    "1466169": { productId: "9677986496805", variantId: "49889638088997", price: 400.00 },
    "1466254": { productId: "9677986496805", variantId: "49889638121765", price: 1500.00 },
    "1466256": { productId: "9677986496805", variantId: "49889638154533", price: 1700.00 },
    "1466258": { productId: "9677986496805", variantId: "49889638187301", price: 2500.00 },
    "1466260": { productId: "9677986496805", variantId: "49889638220069", price: 2800.00 },
    "1466262": { productId: "9677986496805", variantId: "49889638252837", price: 3200.00 },
    "1466264": { productId: "9677986496805", variantId: "49889638285605", price: 3500.00 }
};

// Query the CP OrderItems table to get the full record
let orderItemRecord = await cpOrderItemsTable.selectRecordAsync(orderItemRecordId);

// Validate that the record was found
if (!orderItemRecord) {
    throw new Error(`CP OrderItem record not found with ID: ${orderItemRecordId}`);
}

// Get the SKU from the record
let skuValue = orderItemRecord.getCellValue("SKU");

// Validate that SKU exists
if (!skuValue) {
    throw new Error("SKU is empty. Cannot process this record.");
}

let skuStr = skuValue.toString();
console.log(`Processing SKU: ${skuStr}`);

// Look up the SKU in the mapping
let mapping = SKU_MAPPING[skuStr];

if (!mapping) {
    throw new Error(`SKU ${skuStr} not found in mapping. This SKU is not in the old SKUs list.`);
}

let productIdValue = mapping.productId;
let variantIdValue = mapping.variantId;
let priceAtTime = mapping.price;

console.log(`Found mapping for SKU ${skuStr}:`);
console.log(`  Product ID: ${productIdValue}`);
console.log(`  Variant ID: ${variantIdValue}`);
console.log(`  Price At Time: ${priceAtTime}`);

// Find matching Product record
let productsQuery = await productsTable.selectRecordsAsync({
    fields: ["Product ID"]
});

let productRecord = productsQuery.records.find(record => {
    let productIdField = record.getCellValue("Product ID");
    return productIdField && productIdField.toString() === productIdValue.toString();
});

if (!productRecord) {
    throw new Error(`Product not found for Product ID: ${productIdValue}`);
}

let productRecordId = productRecord.id;
console.log(`Found Product record: ${productRecordId}`);

// Find matching Variant record
let variantsQuery = await variantsTable.selectRecordsAsync({
    fields: ["Variant ID"]
});

let variantRecord = variantsQuery.records.find(record => {
    let variantIdField = record.getCellValue("Variant ID");
    return variantIdField && variantIdField.toString() === variantIdValue.toString();
});

if (!variantRecord) {
    throw new Error(`Variant not found for Variant ID: ${variantIdValue}`);
}

let variantRecordId = variantRecord.id;
console.log(`Found Variant record: ${variantRecordId}`);

// Update the CP OrderItem with all the fields
try {
    await cpOrderItemsTable.updateRecordAsync(orderItemRecordId, {
        "Products": [{ id: productRecordId }],
        "Variants": [{ id: variantRecordId }],
        "Product ID": productIdValue,
        "Variant ID": variantIdValue,
        "Price At Time": priceAtTime
    });
    console.log(`Successfully updated CP OrderItem ${orderItemRecordId}`);
    console.log(`  Linked Product: ${productRecordId}`);
    console.log(`  Linked Variant: ${variantRecordId}`);
    console.log(`  Set Product ID: ${productIdValue}`);
    console.log(`  Set Variant ID: ${variantIdValue}`);
    console.log(`  Set Price At Time: ${priceAtTime}`);
} catch (error) {
    console.error(`Failed to update CP OrderItem ${orderItemRecordId}: ${error.message}`);
    throw error;
}

output.set("orderItemRecordId", orderItemRecordId);
output.set("productRecordId", productRecordId);
output.set("variantRecordId", variantRecordId);
output.set("sku", skuStr);
output.set("message", `Successfully fixed old SKU ${skuStr} for OrderItem ${orderItemRecordId}`);
