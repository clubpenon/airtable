// Airtable Automation Script - BULK MIGRATION
// Trigger: Scheduled automation (run once manually)
// Action: Run this script

// This script performs a one-time bulk migration from Orders table to CP Orders and CP OrderItems tables.
// It processes ALL records in the Orders table independently, just like the create automation.

console.log("=== Starting Bulk Migration ===");

// Define table references
let ordersTable = base.getTable("Orders");
let cpOrdersTable = base.getTable("CP Orders");
let cpOrderItemsTable = base.getTable("CP OrderItems");
let productsTable = base.getTable("Products");
let variantsTable = base.getTable("Variants");
let customersTable = base.getTable("Customers");

// Query all Orders records
console.log("Fetching all Orders records...");
let ordersQuery = await ordersTable.selectRecordsAsync();
console.log(`Found ${ordersQuery.records.length} records in Orders table`);

// Track statistics
let stats = {
    totalRecords: ordersQuery.records.length,
    processedRecords: 0,
    createdCpOrders: 0,
    updatedCpOrders: 0,
    createdOrderItems: 0,
    skippedRecords: 0,
    errors: /** @type {string[]} */ ([])
};

// Process each Orders record independently
for (let orderRecord of ordersQuery.records) {
    try {
        // Extract data from the Orders record
        let orderId = orderRecord.getCellValue("Order ID");

        // Skip records without Order ID
        if (!orderId) {
            stats.errors.push(`Record ${orderRecord.id} has no Order ID, skipping`);
            stats.skippedRecords++;
            continue;
        }

        let orderNumber = orderRecord.getCellValue("Order Number");
        let createdAt = orderRecord.getCellValue("Created At");
        let orderFulfillmentStatus = orderRecord.getCellValue("Order Fulfillment Status");
        let orderPaymentStatus = orderRecord.getCellValue("Order Payment Status");
        let orderCurrency = orderRecord.getCellValue("Order Currency");
        let orderDiscount = orderRecord.getCellValue("Order Discount");
        let orderSubtotal = orderRecord.getCellValue("Order Subtotal");
        let orderShippingPrice = orderRecord.getCellValue("Order Shipping price");
        let orderTax = orderRecord.getCellValue("Order Tax");
        let orderTotal = orderRecord.getCellValue("Order Total");
        let totalWeight = orderRecord.getCellValue("Total Weight");
        let customerIdValue = orderRecord.getCellValue("Customer ID");
        let shippingFirstName = orderRecord.getCellValue("Shipping First Name");
        let shippingLastName = orderRecord.getCellValue("Shipping Last Name");
        let shippingCompanyName = orderRecord.getCellValue("Shipping Company Name");
        let shippingAddress1 = orderRecord.getCellValue("Shipping Address 1");
        let shippingAddress2 = orderRecord.getCellValue("Shipping Address 2");
        let shippingCity = orderRecord.getCellValue("Shipping City");
        let shippingProvince = orderRecord.getCellValue("Shipping Province");
        let shippingPostalCode = orderRecord.getCellValue("Shipping Postal Code");
        let shippingCountry = orderRecord.getCellValue("Shipping Country");
        let tags = orderRecord.getCellValue("Tags");
        let notes = orderRecord.getCellValue("Notes");
        let lineItemProperties = orderRecord.getCellValue("Line Item Properties");
        let lineItemShippingCompany = orderRecord.getCellValue("Line Item Shipping Company");
        let lineItemTrackingNumber = orderRecord.getCellValue("Line Item Tracking Number");
        let orderAdditionalDetails = orderRecord.getCellValue("Order Additional Details");
        let channel = orderRecord.getCellValue("Channel");
        let orderDeliveryStatus = orderRecord.getCellValue("Order Delivery Status");
        let lineItemFulfillmentStatus = orderRecord.getCellValue("Line Item Fulfillment Status");
        let orderDeliveryMethod = orderRecord.getCellValue("Order Delivery Method");
        let orderDiscountCodes = orderRecord.getCellValue("Order Discount Codes");
        let airtableToShopifyLastUpdate = orderRecord.getCellValue("Airtable -> Shopify last successful update");
        let shopifyToAirtableLastUpdate = orderRecord.getCellValue("Shopify -> Airtable last successful update");

        // Extract item data
        let productIdValue = orderRecord.getCellValue("Product ID");
        let variantIdValue = orderRecord.getCellValue("Variant ID");
        let itemId = orderRecord.getCellValue("Item ID");
        let sku = orderRecord.getCellValue("SKU");
        let quantity = orderRecord.getCellValue("Quantity") || 1;

        // Find matching Customer record
        let customerRecordId = null;
        if (customerIdValue) {
            let customersQuery = await customersTable.selectRecordsAsync({
                fields: ["Customer ID"]
            });

            let customerRecord = customersQuery.records.find(record => {
                let customerIdField = record.getCellValue("Customer ID");
                return customerIdField && customerIdField.toString() === customerIdValue.toString();
            });

            if (customerRecord) {
                customerRecordId = customerRecord.id;
            }
        }

        // Find matching Product record
        let productRecordId = null;
        if (productIdValue) {
            let productsQuery = await productsTable.selectRecordsAsync({
                fields: ["Product ID"]
            });

            let productRecord = productsQuery.records.find(record => {
                let productIdField = record.getCellValue("Product ID");
                return productIdField && productIdField.toString() === productIdValue.toString();
            });

            if (productRecord) {
                productRecordId = productRecord.id;
            }
        }

        // Find matching Variant record and get Price At Time
        let variantRecordId = null;
        let priceAtTime;
        if (variantIdValue) {
            let variantsQuery = await variantsTable.selectRecordsAsync({
                fields: ["Variant ID", "Price"]
            });

            let variantRecord = variantsQuery.records.find(record => {
                let variantIdField = record.getCellValue("Variant ID");
                return variantIdField && variantIdField.toString() === variantIdValue.toString();
            });

            if (variantRecord) {
                variantRecordId = variantRecord.id;
                let priceValue = variantRecord.getCellValue("Price");
                // Convert string price to number
                if (priceValue) {
                    priceAtTime = parseFloat(priceValue);
                    if (isNaN(priceAtTime)) {
                        priceAtTime = undefined;
                    }
                }
            }
        }

        // Check if CP Orders record already exists with this Order ID
        let cpOrdersQuery = await cpOrdersTable.selectRecordsAsync({
            fields: ["Order ID"]
        });

        let existingCpOrder = cpOrdersQuery.records.find(record => {
            let existingOrderId = record.getCellValue("Order ID");
            return existingOrderId && existingOrderId.toString() === orderId.toString();
        });

        let cpOrderRecordId;

        if (existingCpOrder) {
            // CP Order already exists - get its record ID
            cpOrderRecordId = existingCpOrder.id;

            // Update any fields that might have changed
            let updateFields = {
                "Order Fulfillment Status": orderFulfillmentStatus,
                "Order Payment Status": orderPaymentStatus,
                "Order Currency": orderCurrency,
                "Order Discount": orderDiscount,
                "Order Subtotal": orderSubtotal,
                "Order Shipping price": orderShippingPrice,
                "Order Tax": orderTax,
                "Order Total": orderTotal,
                "Total Weight": totalWeight,
                "Customer ID": customerIdValue,
                "Shipping First Name": shippingFirstName,
                "Shipping Last Name": shippingLastName,
                "Shipping Company Name": shippingCompanyName,
                "Shipping Address 1": shippingAddress1,
                "Shipping Address 2": shippingAddress2,
                "Shipping City": shippingCity,
                "Shipping Province": shippingProvince,
                "Shipping Postal Code": shippingPostalCode,
                "Shipping Country": shippingCountry,
                "Tags": tags,
                "Notes": notes,
                "Line Item Properties": lineItemProperties,
                "Line Item Shipping Company": lineItemShippingCompany,
                "Line Item Tracking Number": lineItemTrackingNumber,
                "Order Additional Details": orderAdditionalDetails,
                "Channel": channel,
                "Order Delivery Status": orderDeliveryStatus,
                "Line Item Fulfillment Status": lineItemFulfillmentStatus,
                "Order Delivery Method": orderDeliveryMethod,
                "Order Discount Codes": orderDiscountCodes,
                "Airtable -> Shopify last successful update": airtableToShopifyLastUpdate,
                "Shopify -> Airtable last successful update": shopifyToAirtableLastUpdate
            };

            // Add Customer link if found
            if (customerRecordId) {
                updateFields["Customers"] = [{ id: customerRecordId }];
            }

            await cpOrdersTable.updateRecordAsync(cpOrderRecordId, updateFields);
            stats.updatedCpOrders++;
        } else {
            // Build the CP Order fields object
            let cpOrderFields = {
                "Order ID": orderId,
                "Order Number": orderNumber,
                "Created At": createdAt,
                "Order Fulfillment Status": orderFulfillmentStatus,
                "Order Payment Status": orderPaymentStatus,
                "Order Currency": orderCurrency,
                "Order Discount": orderDiscount,
                "Order Subtotal": orderSubtotal,
                "Order Shipping price": orderShippingPrice,
                "Order Tax": orderTax,
                "Order Total": orderTotal,
                "Total Weight": totalWeight,
                "Customer ID": customerIdValue,
                "Shipping First Name": shippingFirstName,
                "Shipping Last Name": shippingLastName,
                "Shipping Company Name": shippingCompanyName,
                "Shipping Address 1": shippingAddress1,
                "Shipping Address 2": shippingAddress2,
                "Shipping City": shippingCity,
                "Shipping Province": shippingProvince,
                "Shipping Postal Code": shippingPostalCode,
                "Shipping Country": shippingCountry,
                "Tags": tags,
                "Notes": notes,
                "Line Item Properties": lineItemProperties,
                "Line Item Shipping Company": lineItemShippingCompany,
                "Line Item Tracking Number": lineItemTrackingNumber,
                "Order Additional Details": orderAdditionalDetails,
                "Channel": channel,
                "Order Delivery Status": orderDeliveryStatus,
                "Line Item Fulfillment Status": lineItemFulfillmentStatus,
                "Order Delivery Method": orderDeliveryMethod,
                "Order Discount Codes": orderDiscountCodes,
                "Airtable -> Shopify last successful update": airtableToShopifyLastUpdate,
                "Shopify -> Airtable last successful update": shopifyToAirtableLastUpdate
            };

            // Add Customer link if found
            if (customerRecordId) {
                cpOrderFields["Customers"] = [{ id: customerRecordId }];
            }

            // Create new CP Order record
            cpOrderRecordId = await cpOrdersTable.createRecordAsync(cpOrderFields);
            stats.createdCpOrders++;
        }

        // Create CP OrderItems records (one for each quantity)
        // First, check how many records already exist for this order with this item ID
        let cpOrderItemsQuery = await cpOrderItemsTable.selectRecordsAsync({
            fields: ["CP Orders", "Item ID"]
        });

        let existingItemCount = cpOrderItemsQuery.records.filter(record => {
            let linkedOrders = record.getCellValue("CP Orders");
            let recordItemId = record.getCellValue("Item ID");

            // Check if this record is linked to our CP Order and has the same Item ID
            if (linkedOrders && Array.isArray(linkedOrders)) {
                let isLinkedToOurOrder = linkedOrders.some(order => order.id === cpOrderRecordId);
                let hasSameItemId = recordItemId && recordItemId.toString() === itemId?.toString();
                return isLinkedToOurOrder && hasSameItemId;
            }
            return false;
        }).length;

        // Calculate how many more records we need to create
        let recordsToCreate = quantity - existingItemCount;

        if (recordsToCreate < 0) {
            recordsToCreate = 0;
        }

        // Create the needed records
        for (let i = 0; i < recordsToCreate; i++) {
            // Build the fields object
            let orderItemFields = {
                "Product ID": productIdValue,
                "Variant ID": variantIdValue,
                "Item ID": itemId,
                "SKU": sku,
                "Price At Time": priceAtTime,
                "CP Orders": [{ id: cpOrderRecordId }]
            };

            // Add Product link if found
            if (productRecordId) {
                orderItemFields["Products"] = [{ id: productRecordId }];
            }

            // Add Variant link if found
            if (variantRecordId) {
                orderItemFields["Variants"] = [{ id: variantRecordId }];
            }

            await cpOrderItemsTable.createRecordAsync(orderItemFields);
            stats.createdOrderItems++;
        }

        stats.processedRecords++;

        // Log progress every 50 records
        if (stats.processedRecords % 50 === 0) {
            console.log(`Progress: ${stats.processedRecords}/${stats.totalRecords} records processed`);
        }

    } catch (error) {
        stats.errors.push(`Error processing record ${orderRecord.id}: ${error.message}`);
        console.error(`Error processing record ${orderRecord.id}: ${error.message}`);
    }
}

// Final summary
console.log("\n=== Migration Complete ===");
console.log(`Total Orders records: ${stats.totalRecords}`);
console.log(`Records processed: ${stats.processedRecords}`);
console.log(`Records skipped: ${stats.skippedRecords}`);
console.log(`CP Orders created: ${stats.createdCpOrders}`);
console.log(`CP Orders updated: ${stats.updatedCpOrders}`);
console.log(`CP OrderItems created: ${stats.createdOrderItems}`);
console.log(`Errors: ${stats.errors.length}`);

if (stats.errors.length > 0) {
    console.log("\nErrors encountered:");
    stats.errors.slice(0, 20).forEach(error => console.log(`  - ${error}`));
    if (stats.errors.length > 20) {
        console.log(`  ... and ${stats.errors.length - 20} more errors`);
    }
}

output.set("summary", {
    totalRecords: stats.totalRecords,
    processedRecords: stats.processedRecords,
    skippedRecords: stats.skippedRecords,
    createdCpOrders: stats.createdCpOrders,
    updatedCpOrders: stats.updatedCpOrders,
    createdOrderItems: stats.createdOrderItems,
    errorsCount: stats.errors.length
});
