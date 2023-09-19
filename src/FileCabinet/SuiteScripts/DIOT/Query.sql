SELECT    BUILTIN_RESULT.TYPE_INTEGER("TRANSACTION"."ID") AS "ID" , 
  BUILTIN_RESULT.TYPE_STRING(BUILTIN.DF("TRANSACTION".entity)) AS entity , 
  BUILTIN_RESULT.TYPE_STRING(Vendor.companyname) AS companyname , 
  BUILTIN_RESULT.TYPE_STRING(BUILTIN.DF(Vendor.custentity_fb_diot_prov_type)) AS custentity_fb_diot_prov_type , 
  BUILTIN_RESULT.TYPE_BOOLEAN("TRANSACTION".custbody_fb_diot_importacion) AS custbody_fb_diot_importacion , 
  BUILTIN_RESULT.TYPE_PERCENT(transactionTaxDetail.taxrate) AS taxrate , 
  BUILTIN_RESULT.TYPE_CURRENCY(BUILTIN.CONSOLIDATE(transactionTaxDetail.basetaxamount, 'LEDGER', 'DEFAULT', 'DEFAULT', 2, 162, 'DEFAULT'), BUILTIN.CURRENCY(BUILTIN.CONSOLIDATE(transactionTaxDetail.basetaxamount, 'LEDGER', 'DEFAULT', 'DEFAULT', 2, 162, 'DEFAULT'))) AS basetaxamount , 
  BUILTIN_RESULT.TYPE_CURRENCY(BUILTIN.CONSOLIDATE(transactionTaxDetail.taxbasis, 'INCOME', 'NONE', 'DEFAULT', 0, 0, 'DEFAULT'), BUILTIN.CURRENCY(BUILTIN.CONSOLIDATE(transactionTaxDetail.taxbasis, 'INCOME', 'NONE', 'DEFAULT', 0, 0, 'DEFAULT'))) AS taxbasis , 
  BUILTIN_RESULT.TYPE_STRING(BUILTIN.DF(transactionTaxDetail.taxcode)) AS taxcode , 
  BUILTIN_RESULT.TYPE_STRING(BUILTIN.DF("TRANSACTION".custbody_fb_tipo_operacion)) AS custbody_fb_tipo_operacion , 
  BUILTIN_RESULT.TYPE_STRING(Vendor.custentity_efx_fe_numregidtrib) AS custentity_efx_fe_numregidtrib , 
  BUILTIN_RESULT.TYPE_STRING(BUILTIN.DF(Vendor.custentity_fb_pais_residencia)) AS custentity_fb_pais_residencia , 
  BUILTIN_RESULT.TYPE_STRING(Vendor.custentity_fb_nombre_extranjero) AS custentity_fb_nombre_extranjero , 
  BUILTIN_RESULT.TYPE_STRING(Vendor.custentity_fb_nacionalidad) AS custentity_fb_nacionalidad , 
  BUILTIN_RESULT.TYPE_STRING(Vendor.custentity_mx_rfc) AS custentity_mx_rfc 
FROM 
  "TRANSACTION", 
  Vendor, 
  transactionTaxDetail, 
  transactionLine
WHERE 
  ((("TRANSACTION".entity = Vendor."ID"(+) AND "TRANSACTION"."ID" = transactionTaxDetail."TRANSACTION"(+)) AND "TRANSACTION"."ID" = transactionLine."TRANSACTION"))
   AND ((Vendor.custentity_fb_diot_prov_type IN ('1', '2', '3') AND NVL("TRANSACTION".voided, 'F') = ? AND "TRANSACTION".postingperiod IN ('160') AND transactionLine.subsidiary IN ('2') AND "TRANSACTION".custbody_fb_tipo_operacion IN ('1', '2', '3') AND "TRANSACTION"."TYPE" IN ('VendCred') AND transactionLine.mainline = ?))


AND 
"TRANSACTION".custbody_fb_tipo_operacion IN ('1', '2', '3') 