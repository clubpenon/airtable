// Airtable Automation Script - Fix Missing Products Link
// Trigger: When a record is created or updated in "CP OrderItems" table
// Conditions: Products link is empty AND Variants link is not empty
// Action: Run this script

// This script fetches the Product ID from the Variants table and creates the Products link

// Get the input configuration
let inputConfig = input.config();
let orderItemRecordId = inputConfig.orderItemRecordId;

// Define table references
let cpOrderItemsTable = base.getTable("CP OrderItems");
let variantsTable = base.getTable("Variants");
let productsTable = base.getTable("Products");

// Query the CP OrderItems table to get the full record
let orderItemRecord = await cpOrderItemsTable.selectRecordAsync(orderItemRecordId);

// Validate that the record was found
if (!orderItemRecord) {
    throw new Error(`CP OrderItem record not found with ID: ${orderItemRecordId}`);
}

// Get the Variants link
let variantsLink = orderItemRecord.getCellValue("Variants");

// Validate that Variants link exists
if (!variantsLink || !Array.isArray(variantsLink) || variantsLink.length === 0) {
    throw new Error("Variants link is empty. Cannot fetch Product ID.");
}

// Get the first variant record ID (should only be one)
let variantRecordId = variantsLink[0].id;

// Query the Variants table to get the variant record with Product ID and SKU
let variantRecord = await variantsTable.selectRecordAsync(variantRecordId);

if (!variantRecord) {
    throw new Error(`Variant record not found with ID: ${variantRecordId}`);
}

// Get the Product ID and SKU from the variant
let productIdValue = variantRecord.getCellValue("Product ID");
let skuValue = variantRecord.getCellValue("SKU");

if (!productIdValue) {
    throw new Error(`Variant record ${variantRecordId} has no Product ID`);
}

console.log(`Found Product ID: ${productIdValue} from Variant: ${variantRecordId}`);
if (skuValue) {
    console.log(`Found SKU: ${skuValue}`);
}

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

// Update the CP OrderItem with the Products link, Product ID, and SKU
try {
    let updateFields = {
        "Products": [{ id: productRecordId }],
        "Product ID": productIdValue
    };

    // Add SKU if available
    if (skuValue) {
        updateFields["SKU"] = skuValue;
    }

    await cpOrderItemsTable.updateRecordAsync(orderItemRecordId, updateFields);
    console.log(`Successfully linked Product ${productRecordId} to CP OrderItem ${orderItemRecordId}`);
    console.log(`Set Product ID field to: ${productIdValue}`);
    if (skuValue) {
        console.log(`Set SKU field to: ${skuValue}`);
    }
} catch (error) {
    console.error(`Failed to update CP OrderItem ${orderItemRecordId}: ${error.message}`);
    throw error;
}

output.set("orderItemRecordId", orderItemRecordId);
output.set("productRecordId", productRecordId);
output.set("message", `Successfully linked Product ${productRecordId} to OrderItem ${orderItemRecordId}`);
