// Airtable Automation Script
// Trigger: When a record is created in "Orders" table
// Action: Run this script

// Get the input configuration (the record that triggered the automation)
let inputConfig = input.config();
let orderRecordId = inputConfig.orderRecordId;

// Define table references
let ordersTable = base.getTable("Orders");
let cpOrdersTable = base.getTable("CP Orders");
let cpOrderItemsTable = base.getTable("CP OrderItems");

// Query the Orders table to get the full record
let orderRecord = await ordersTable.selectRecordAsync(orderRecordId);

// Validate that the record was found
if (!orderRecord) {
    throw new Error(`Order record not found with ID: ${orderRecordId}`);
}

// Extract data from the triggering Orders record
let orderId = orderRecord.getCellValue("Order ID");

// Validate required fields
if (!orderId) {
    throw new Error("Order ID is required but was not found in the record");
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
let quantity = orderRecord.getCellValue("Quantity") || 1; // Default to 1 if not set

// Define references for Products, Variants, and Customers tables
let productsTable = base.getTable("Products");
let variantsTable = base.getTable("Variants");
let customersTable = base.getTable("Customers");

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
    } else {
        console.warn(`Customer not found for Customer ID: ${customerIdValue}`);
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
    } else {
        console.warn(`Product not found for Product ID: ${productIdValue}`);
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
                console.warn(`Invalid price format for Variant ID ${variantIdValue}: ${priceValue}`);
                priceAtTime = undefined;
            }
        }
    } else {
        console.warn(`Variant not found for Variant ID: ${variantIdValue}`);
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
    console.log(`CP Order already exists for Order ID: ${orderId}. Record ID: ${cpOrderRecordId}`);

    // Update any fields that might have changed
    try {
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
        console.log(`Successfully updated CP Order record ${cpOrderRecordId} for Order ID: ${orderId}`);
    } catch (error) {
        console.error(`Failed to update CP Order record ${cpOrderRecordId}: ${error.message}`);
        throw error;
    }
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

    console.log(`Created new CP Order record. Record ID: ${cpOrderRecordId}`);
}

// Create CP OrderItems records (one for each quantity)
// Since CP OrderItems doesn't have a quantity field, we create multiple records

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

console.log(`Found ${existingItemCount} existing CP OrderItem record(s) for Order ID ${orderId} with Item ID ${itemId}`);

// Calculate how many more records we need to create
let recordsToCreate = quantity - existingItemCount;

if (recordsToCreate < 0) {
    console.warn(`Warning: More records exist (${existingItemCount}) than expected quantity (${quantity}) for Item ID ${itemId}`);
    recordsToCreate = 0;
}

let orderItemRecordIds = [];

for (let i = 0; i < recordsToCreate; i++) {
    // Build the fields object
    let orderItemFields = {
        "Product ID": productIdValue,
        "Variant ID": variantIdValue,
        "Item ID": itemId,
        "SKU": sku,
        "Price At Time": priceAtTime,
        "CP Orders": [{ id: cpOrderRecordId }] // Link to CP Orders record
    };

    // Add Product link if found
    if (productRecordId) {
        orderItemFields["Products"] = [{ id: productRecordId }];
    }

    // Add Variant link if found
    if (variantRecordId) {
        orderItemFields["Variants"] = [{ id: variantRecordId }];
    }

    let orderItemRecordId = await cpOrderItemsTable.createRecordAsync(orderItemFields);

    orderItemRecordIds.push(orderItemRecordId);
}

console.log(`Created ${orderItemRecordIds.length} CP OrderItem record(s) for Order ID: ${orderId}`);
console.log(`Order Item Record IDs: ${orderItemRecordIds.join(", ")}`);

output.set("cpOrderRecordId", cpOrderRecordId);
output.set("orderItemRecordIds", orderItemRecordIds);
output.set("message", `Successfully processed order ${orderId}. CP Order: ${cpOrderRecordId}, OrderItems: ${orderItemRecordIds.length}`);
