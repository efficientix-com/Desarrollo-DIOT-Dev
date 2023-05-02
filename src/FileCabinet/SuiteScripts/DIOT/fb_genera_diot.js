/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url', 'N/record', 'N/file', 'N/redirect', 'N/config', 'N/email', './fb_diot_constants_lib', './moment_diot.js'],

    (runtime, search, url, record, file, redirect, config, email, values, moment) => {

        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        var taxRateArray = new Array();
        var erroresArray = new Array();

        const SCRIPTS_INFO = values.SCRIPTS_INFO;
        const RECORD_INFO = values.RECORD_INFO;
        const STATUS_LIST_DIOT = values.STATUS_LIST_DIOT;
        const RUNTIME = values.RUNTIME;
        const COMPANY_INFORMATION = values.COMPANY_INFORMATION;

        const getInputData = (inputContext) => {
            try{

                /** Se obtienen los parametros dados por el usuario */
                var objScript = runtime.getCurrentScript();
                var subsidiaria = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.SUBSIDIARY });
                var periodo = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.PERIOD });
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID }); 
                //log.debug('Datos', subsidiaria + " " + periodo);

                log.audit({title: 'MR', details: "Se esta ejecutando el MR: getInputData"});

                var otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.OBTAINING_DATA
                    }
                });

                /** Se obtiene el motor que se esta usando (legacy or suitetax) */
                var suitetax = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUITETAX });
                log.audit({title: 'suitetax', details: suitetax});
                
                /* Se realiza la búsqueda de todos los códigos de impuesto */
                var codigosImpuesto = searchCodigoImpuesto(suitetax);

                return codigosImpuesto;

            } catch (error) {
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en la busqueda de Códigos de Impuesto', details: error });
            }

        }
        
        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {

            try{
                var objScript = runtime.getCurrentScript();
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID }); 
                log.debug('Estado', "Se esta ejecutando el Map");
                var otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.VALIDATING_DATA
                    }
                });
                var results = JSON.parse(mapContext.value);
                //log.debug('Resultados de getInput', results);
                /** Se obtiene el motor que se esta usando (legacy or suitetax) */
                // Revisar la carga de registros de los códigos de impuesto
                var suitetax = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUITETAX });
                var taxRate, codeName, taxType;

                if(suitetax){
                    /* Registro de cada resultado del map */
                    var taxCodeRecord = record.load({
                        type: record.Type.SALES_TAX_ITEM,
                        id: results.id
                    });
    
                    taxRate = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_RATE });
                    codeName = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_CODE });
                    taxType = taxCodeRecord.getText({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_TYPE });
                }else{
                    /* Registro de cada resultado del map */
                    var taxCodeRecord = record.load({
                        type: record.Type.SALES_TAX_ITEM,
                        id: results.id
                    });
    
                    taxRate = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_RATE });
                    codeName = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_CODE });
                    taxType = taxCodeRecord.getText({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_TYPE });
                }

                var numCodigos = searchCodigoImpuesto(suitetax).runPaged().count;

                /* Ingresar datos necesarios a un arreglo para mandar el valor al reduce */
                //taxRateArray.push(taxRate+"/"+codeName+"/"+taxType);

                taxRateArray.push({
                    taxRate: taxRate,
                    codeName: codeName,
                    taxType: taxType
                })

                /* Se manda el último arreglo al reduce, es decir el que ya contiene todos los datos */
                if(taxRateArray.length == numCodigos){
                    mapContext.write({
                        key: "taxRate",
                        value: JSON.stringify(taxRateArray)
                    });
                }   

            }catch(error){
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error al realizar el registro de cada resultado', details: error });
            }

        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {

            try{
                log.debug('Estado', "Se esta ejecutando el Reduce");
                log.debug('Reduce', reduceContext);
                
                /** Se obtienen los parametros dados por el usuario */
                var objScript = runtime.getCurrentScript();
                var subsidiaria = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.SUBSIDIARY });
                var periodo = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.PERIOD });
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                var oneWorldFeature = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUBSIDIARIES });
                log.debug('OneWorld', oneWorldFeature);

                var nombreSubsidiaria = '', nombrePeriodo = '';
                
                var nombrePer = search.lookupFields({
                    type: search.Type.ACCOUNTING_PERIOD,
                    id: periodo,
                    columns: [RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.NAME]
                });
                var nombrePeriodo = nombrePer.periodname;

                /** si no es one world obtiene el nombre de la empresa */
                var compname = '';
                
                if(oneWorldFeature){
                    var nombreSub = search.lookupFields({
                        type: search.Type.SUBSIDIARY,
                        id: subsidiaria,
                        columns: [RECORD_INFO.SUBSIDIARY_RECORD.FIELDS.NAME_NOHIERARCHY]
                    });
                    nombreSubsidiaria = nombreSub.namenohierarchy;
                    var otherId = record.submitFields({
                        type: RECORD_INFO.DIOT_RECORD.ID,
                        id: recordID,
                        values: {
                            [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.BUILDING,
                        }
                    });
                }else{
                    //buscar nombre empresa principal
                    var companyInfo = config.load({
                        type: config.Type.COMPANY_INFORMATION
                    });
                    
                    compname = companyInfo.getValue({
                        fieldId: COMPANY_INFORMATION.FIELDS.ID
                    });

                    var otherId = record.submitFields({
                        type: RECORD_INFO.DIOT_RECORD.ID,
                        id: recordID,
                        values: {
                            [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.BUILDING,
                        }
                    });
                }

                log.debug('Company', compname);


                /** Se obtiene el motor que se esta usando (legacy or suitetax) */
                var suitetax = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUITETAX });

                /** Se obtienen los valores enviados en el map (códigos de impuesto encontrados en la búsqueda ) */
                var valores = JSON.parse(reduceContext.values[0]);
                //log.debug('Valores', valores);

                /** Se realiza una búsqueda del desglose de impuestos */
                var desgloseImpuestos = search.lookupFields({
                    type: RECORD_INFO.DESGLOSE_TAX_RECORD.ID,
                    id: 1,
                    columns: [RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.EXENTO, RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.IVA, RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.RETENCION]
                });

                var exentos = desgloseImpuestos[RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.EXENTO];
                log.debug('Exentos', exentos);
                var iva = desgloseImpuestos[RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.IVA];
                log.debug('Iva', iva);
                var retenciones = desgloseImpuestos[RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.RETENCION];
                log.debug('Retenciones', retenciones);
    
                /** Se realiza la búsqueda de las distintas transacciones */
                var facturasProv, informesGastos, polizasDiario;
                if(oneWorldFeature){
                    facturasProv = searchVendorBill(subsidiaria, periodo, suitetax, valores, exentos, iva, retenciones);
                    informesGastos = searchExpenseReports(subsidiaria, periodo, suitetax, valores, exentos, iva, retenciones);
                    polizasDiario = searchDailyPolicy(subsidiaria, periodo, suitetax, valores, exentos, iva, retenciones);
                }else{
                    facturasProv = searchVendorBillOW(periodo, suitetax, valores, exentos, iva, retenciones);
                    informesGastos = searchExpenseReportsOW(periodo, suitetax, valores, exentos, iva, retenciones);
                    polizasDiario = searchDailyPolicyOW(periodo, suitetax, valores, exentos, iva, retenciones);
                }

                /** Verifica si existe algún error */
                var erroresTran = '';
                var error = false;
                if(facturasProv.length != 0){
                    for(var i = 0; i < facturasProv.length; i++){
                        if(facturasProv[i].datos[0].errores != ''){
                            error = true;
                            erroresTran = erroresTran + facturasProv[i].datos[0].errores;
                        }
                    }
                }
                if(informesGastos.length != 0){
                    for(var i = 0; i < informesGastos.length; i++){
                        if(informesGastos[i].datos[0].errores != ''){
                            error = true;
                            erroresTran = erroresTran + informesGastos[i].datos[0].errores;
                        }
                    }
                }
                if(polizasDiario.length != 0){
                    for(var i = 0; i < polizasDiario.length; i++){
                        if(polizasDiario[i].datos[0].errores != ''){
                            error = true;
                            erroresTran = erroresTran + polizasDiario[i].datos[0].errores;
                        }
                    }
                }

                //Se separan los errores y se meten en un arreglo
                var erroresArrayAux = erroresTran.split('/');
                //Se meten en un arreglo final para evitar los errores repetidos
                for (var i = 0; i < erroresArrayAux.length; i++){
                    if(erroresArray.length != 0){
                        var existe = buscarError(erroresArrayAux[i], erroresArray);
                        if(!existe){
                            erroresArray.push(erroresArrayAux[i]);
                        }
                    }else{
                        erroresArray.push(erroresArrayAux[i]);
                    }
                }

                /** Se crea el folder raíz y el archivo si no hay errores */
                if(!error){
                    var nombreFolder = RECORD_INFO.FOLDER_RECORD.FIELDS.VALUE;
                    //se realiza una búsqueda para ver si ya existe la carpeta
                    var folder = searchFolder(nombreFolder);
                    var folderId;
                    if(folder.runPaged().count != 0){ //existe
                        folder.run().each(function(result){
                            folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                            return true;
                        });
                        log.debug('Info', 'La carpeta ' + folderId + ' existe');
                    }else{ // si no existe se crea el folder
                        var objRecord = record.create({
                            type: record.Type.FOLDER,
                            isDynamic: true
                        });
                        objRecord.setValue({
                            fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                            value: nombreFolder
                        });
                        folderId = objRecord.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                        log.debug('Info', 'Se creo la carpeta con id ' + folderId);
                    }
    
                    /** Parámetros desde las preferencias de la empresa */
                    var tipoGuardado = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.TIPO_GUARDADO });
                    log.debug('Tipo guardado', tipoGuardado );
                    var nombreArchivo = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.NOMBRE_ARCHIVO });
                    log.debug('Nombre archivo', nombreArchivo);
    
                    // si no es oneWorld el tipo de guardado solo será por periodo
                    if(oneWorldFeature == false){
                        tipoGuardado = 2;
                    }
                    // si no se especifico el tipo de guardado, el default será por subsidiarias
                    if(tipoGuardado == ''){
                        tipoGuardado = 1;
                    }
    
                    //se manda crear el folder dentro de la carpeta raíz y se obtiene el id de la carpeta
                    var subFolderId = createFolder(nombreSubsidiaria, nombrePeriodo, tipoGuardado, folderId);
                    log.debug('SubFolder', subFolderId);
    
                    
                    /** Se obtienen los datos con el que se va a guardar el nombre del archivo */
                    nombreArchivo = nombreArchivo.toUpperCase();
                    var arrayDatos = nombreArchivo.split('_');
                    var fecha = new Date();
                    //se quitan los espacios de nombre subsidiaria y periodo
                    var subsi = nombreSubsidiaria.replace(/\s+/g, '');
                    var per = nombrePeriodo.replace(/\s+/g, '')
                    var nombreTxt = '';
                    for(var i = 0; i < arrayDatos.length; i++){
                        var dato = getData(arrayDatos[i], subsi, per, fecha);
                        nombreTxt = nombreTxt + dato;
                        if((i+1) != arrayDatos.length){
                            nombreTxt = nombreTxt + '_';
                        }
                    }
                    log.debug('NombreTXT', nombreTxt);

                    // Estructura de datos
                    var idProv = new Array();
                    idProv = buscaProveedores(facturasProv, informesGastos, polizasDiario);
                    log.debug('Array Prov', idProv);

                    /**
                     * ! Columnas para la DIOT
                     * ? tercero
                     * ? operacion
                     * ? rfc
                     * ? taxid
                     * ? nombreExtranjero
                     * ? pais
                     * ? nacionalidad
                     * ? iva1516(importe)
                     * ? pendiente(región norte)(impuestos)
                     * ? importacion1516(impuestos)
                     * ? importacion1011(impuestos)
                     * ? importacionexentos(siniva)
                     * ? iva0(siniva)
                     * ? retencion(impuestos)
                     * ? devoluciones(impuestos)
                     */
                    var arrayTxt = new Array();

                    if(idProv.length != 0){
                        
                        //se estructuran los datos
                        arrayTxt = estructuraDatos(idProv, facturasProv, informesGastos, polizasDiario, suitetax);
                        if(arrayTxt.length != 0){ //si el archivo contiene algo

                            //Se checa que el contenido del archivo no este vacío
                            var vacio = true;
                            for(var i = 0; i < arrayTxt.length; i++){
                                if(arrayTxt[i] != ''){
                                    vacio = false;
                                }
                            }

                            if(!vacio){ //si hay información
                                var txt = arrayTxt.toString();
                                var txtFinal = txt.replace(/,+/g,'');
                                
                                /** Se busca que no exista el nombre del archivo en la carpeta */
                                var archivos = [];
                                var folderSearchObj = search.create({
                                    type: RECORD_INFO.FOLDER_RECORD.ID,
                                    filters:
                                    [
                                       [RECORD_INFO.FOLDER_RECORD.FIELDS.ID,search.Operator.ANYOF,subFolderId], 
                                       "AND", 
                                       [RECORD_INFO.FOLDER_RECORD.FIELDS.FILE_NAME,search.Operator.STARTSWITH,nombreTxt]
                                    ],
                                    columns:
                                    [
                                       search.createColumn({
                                          name: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                                          join: RECORD_INFO.FOLDER_RECORD.FIELDS.FILE,
                                          sort: search.Sort.DESC
                                       })
                                    ]
                                 });
                                var numArchivos = folderSearchObj.runPaged().count;
                                folderSearchObj.run().each(function(result){
                                    var archivo = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME, join: RECORD_INFO.FOLDER_RECORD.FIELDS.FILE });
                                    archivos.push(archivo);
                                    return true;
                                });
                                if(numArchivos == 0){//no existe el nombre
                                
                                }else{
                                    var numCaracteres = nombreTxt.length;
                                    log.debug('Archivos',archivos);
                                    log.debug('Archivos', archivos[0]);
                                    var lastFile = archivos[0];
                                    var n = lastFile.substring(numCaracteres); //obtiene el ultimo numero de archivo
                                    if(n != ''){
                                        var num = n.replace(/_+/g,'');
                                        num = parseFloat(num) + 1;
                                        nombreTxt = nombreTxt + '_' + num;
                                    }else{ //es el primer archivo
                                        nombreTxt = nombreTxt + '_' + 1;
                                    }
                                }
                                log.debug('Nombre Final', nombreTxt);
        
                                /** Se crea el archivo txt, se indica el folder en el que se va a guardar*/
                                var fileObj = file.create({
                                    name    : nombreTxt,
                                    fileType: file.Type.PLAINTEXT,
                                    folder: subFolderId,
                                    contents: txtFinal
                                });
                                var fileId = fileObj.save();
                                log.debug('Info txt', 'Id: ' + fileId);
                                otherId = record.submitFields({
                                    type: RECORD_INFO.DIOT_RECORD.ID,
                                    id: recordID,
                                    values: {
                                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.COMPLETE,
                                        [RECORD_INFO.DIOT_RECORD.FIELDS.FOLDER_ID]: subFolderId,
                                        [RECORD_INFO.DIOT_RECORD.FIELDS.FILE]: fileId
                                    }
                                });
                            }else{ //si no contiene nada, no se crea el archivo
                                var error = 'El archivo no se creo debido a que las transacciones no contienen importes y/o impuestos pertenecientes a cada columna ';
                                otherId = record.submitFields({
                                    type: RECORD_INFO.DIOT_RECORD.ID,
                                    id: recordID,
                                    values: {
                                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error
                                    }
                                });
                            }
                        }
                    }else{ //no existen transacciones
                        var error = 'No se encontaron transacciones en ese periodo';
                        otherId = record.submitFields({
                            type: RECORD_INFO.DIOT_RECORD.ID,
                            id: recordID,
                            values: {
                                [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                                [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error
                            }
                        });
                    }

                } else{ //si hay error no se crea el folder ni el archivo, solo se actualiza el campo de estado
                    otherId = record.submitFields({
                        type: RECORD_INFO.DIOT_RECORD.ID,
                        id: recordID,
                        values: {
                            [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                            [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: erroresArray
                        }
                    });
                }
    
                /** Verifica que las búsquedas no esten vacías */
                if(facturasProv.length == 0 && informesGastos.length == 0 && polizasDiario.length == 0) {
                    log.debug('Busquedas', 'No se encontaron transacciones en ese periodo');
                    // tener en cuenta que aqui se puede mandar ese texto en un key de objeto para manejar error directamente en el pantalla de la DIOT
                } else {
                    log.debug("Facturas", facturasProv);
                    log.debug("Informes", informesGastos);
                    log.debug("Polizas", polizasDiario);
                }
            }catch(error){
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en las búsquedas de transacciones', details: error });
            }
        }

        function estructuraDatos(idProv, facturasProv, informesGastos, polizasDiario, suitetax){
            var arrayTxt = new Array();
            for (var id_prov = 0; id_prov < idProv.length; id_prov++) {
                var prov = idProv[id_prov];
                var tercero, operacion, rfc, taxid, nombreExtranjero, pais, nacionalidad, iva1516 = 0, regionNorte = 0, importacion1516 = 0, importacion1011 = 0, importacionExento = 0, iva0 = 0, exento = 0, retencion = 0, devoluciones = 0;
                if(facturasProv.length != 0){
                    for (var factura = 0; factura < facturasProv.length; factura++) {
                        var prov_operacion = facturasProv[factura].proveedor + facturasProv[factura].tipoOperacion;
                        if(prov_operacion == prov){
                            tercero = facturasProv[factura].tipoTercero;
                            operacion = facturasProv[factura].tipoOperacion;
                            rfc = facturasProv[factura].datos[0].rfc;
                            taxid = facturasProv[factura].datos[0].taxID;
                            nombreExtranjero = facturasProv[factura].datos[0].nombreExtranjero;
                            pais = facturasProv[factura].datos[0].paisResidencia;
                            nacionalidad = facturasProv[factura].datos[0].nacionalidad;
                            var importe;
                            if(facturasProv[factura].importe != ""){
                                importe = parseFloat(facturasProv[factura].importe);
                                importe = Math.abs(importe);
                            }else{
                                importe = 0;
                            }
                            var impuestos;
                            if(facturasProv[factura].impuestos != ""){
                                impuestos = parseFloat(facturasProv[factura].impuestos);
                                impuestos = Math.abs(impuestos);
                            }else{
                                impuestos = 0;
                            }
                            var credito = facturasProv[factura].credito;
                            var tasa = parseFloat(facturasProv[factura].tasa);
                            tasa = Math.abs(tasa);
                            if(facturasProv[factura].tipoDesglose == 'Exento'){
                                if(facturasProv[factura].exportacionBienes == true){
                                    exento = exento + importe;
                                }else{
                                    importacionExento = importacionExento + importe;
                                }
                            }else if(facturasProv[factura].tipoDesglose == 'Iva'){
                                if (tasa == 0) {
                                    iva0 = iva0 + importe;
                                }else if(tasa == 8){ //zona fronteriza
                                    regionNorte = regionNorte + impuestos;
                                }else if(tasa == 15 || tasa == 16){
                                    if(facturasProv[factura].exportacionBienes == true){
                                        iva1516 = iva1516 + importe;
                                    }else{
                                        importacion1516 = importacion1516 + impuestos;
                                    }
                                }else if(tasa == 10 || tasa == 11){
                                    if(facturasProv[factura].exportacionBienes == false){
                                        importacion1011 = importacion1011 + impuestos;
                                    }
                                }
                            }else if(facturasProv[factura].tipoDesglose == 'Retenciones'){
                                retencion = retencion + impuestos;
                            }

                            if(credito != ''){
                                for(var cred = 0; cred < credito.length; cred++){
                                    var credImpuestos = parseFloat(credito[cred].impuesto);
                                    credImpuestos = Math.abs(credImpuestos);
                                    devoluciones = devoluciones + credImpuestos;
                                }
                            }
                        }
                    }
                }
                if(informesGastos.length != 0){
                    for (var informe = 0; informe < informesGastos.length; informe++) {
                        var prov_operacion = informesGastos[informe].proveedor + informesGastos[informe].tipoOperacion;
                        if(prov_operacion == prov){
                            tercero = informesGastos[informe].tipoTercero;
                            operacion = informesGastos[informe].tipoOperacion;
                            rfc = informesGastos[informe].datos[0].rfc;
                            taxid = informesGastos[informe].datos[0].taxID;
                            nombreExtranjero = informesGastos[informe].datos[0].nombreExtranjero;
                            pais = informesGastos[informe].datos[0].paisResidencia;
                            nacionalidad = informesGastos[informe].datos[0].nacionalidad;
                            var importe;
                            if(informesGastos[informe].importe != ""){
                                importe = parseFloat(informesGastos[informe].importe);
                                importe = Math.abs(importe);
                            }else{
                                importe = 0;
                            }
                            var impuestos;
                            if(informesGastos[informe].impuestos != ""){
                                impuestos = parseFloat(informesGastos[informe].impuestos);
                                impuestos = Math.abs(impuestos);
                            }else{
                                impuestos = 0;
                            }
                            var tasa = parseFloat(informesGastos[informe].tasa);
                            tasa = Math.abs(tasa);
                            if(informesGastos[informe].tipoDesglose == 'Exento'){
                                if(informesGastos[informe].importacionBienes == true){
                                    importacionExento = importacionExento + importe;
                                }else{
                                    exento = exento + importe;
                                }
                            }else if(informesGastos[informe].tipoDesglose == 'Iva'){
                                if (tasa == 0) {
                                    iva0 = iva0 + importe;
                                }else if(tasa == 8){ //zona fronteriza
                                    regionNorte = regionNorte + impuestos;
                                }else if(tasa == 15 || tasa == 16){
                                    if(informesGastos[informe].importacionBienes == true){
                                        importacion1516 = importacion1516 + impuestos;
                                    }else{
                                        iva1516 = iva1516 + importe;
                                    }
                                }else if(tasa == 10 || tasa == 11){
                                    if(informesGastos[informe].importacionBienes == true){
                                        importacion1011 = importacion1011 + impuestos;
                                    }
                                }
                            }else if(informesGastos[informe].tipoDesglose == 'Retenciones'){
                                retencion = retencion + impuestos;
                            }
                        }
                    }
                }
                if(polizasDiario.length != 0){
                    for (var poliza = 0; poliza < polizasDiario.length; poliza++) {
                        var prov_operacion = polizasDiario[poliza].proveedor + polizasDiario[poliza].tipoOperacion;
                        if(prov_operacion == prov){
                            tercero = polizasDiario[poliza].tipoTercero;
                            operacion = polizasDiario[poliza].tipoOperacion;
                            rfc = polizasDiario[poliza].datos[0].rfc;
                            taxid = polizasDiario[poliza].datos[0].taxID;
                            nombreExtranjero = polizasDiario[poliza].datos[0].nombreExtranjero;
                            pais = polizasDiario[poliza].datos[0].paisResidencia;
                            nacionalidad = polizasDiario[poliza].datos[0].nacionalidad;
                            var importe;
                            if(polizasDiario[poliza].importe != ""){
                                importe = parseFloat(polizasDiario[poliza].importe);
                                importe = Math.abs(importe);
                            }else{
                                importe = 0;
                            }
                            var impuestos;
                            if(polizasDiario[poliza].impuestos != ""){
                                impuestos = parseFloat(polizasDiario[poliza].impuestos);
                                impuestos = Math.abs(impuestos);
                            }else{
                                impuestos = 0;
                            }
                            var tasa;
                            if(suitetax){
                                if(polizasDiario[poliza].codigos != ''){
                                    tasa = parseFloat(polizasDiario[poliza].codigos[0].tasa);
                                    tasa = Math.abs(tasa);
                                    if(polizasDiario[poliza].codigos[0].tipoDesglose == 'Iva'){
                                        if(tasa == 8){ //zona fronteriza
                                            regionNorte = regionNorte + impuestos;
                                        }else if(tasa == 15 || tasa == 16){
                                            if(polizasDiario[poliza].importacionBienes == true){
                                                importacion1516 = importacion1516 + impuestos;
                                            }else{
                                                iva1516 = iva1516 + importe;
                                            }
                                        }else if(tasa == 10 || tasa == 11){
                                            if(polizasDiario[poliza].importacionBienes == true){
                                                importacion1011 = importacion1011 + impuestos;
                                            }
                                        }
                                    }else if(polizasDiario[poliza].codigos[0].tipoDesglose == 'Retenciones'){
                                        retencion = retencion + impuestos;
                                    }
                                }
                            }
                        }
                    }
                }

                

                iva1516 = evaluar(Math.round(iva1516));
                regionNorte = evaluar(Math.round(regionNorte));
                importacion1516 = evaluar(Math.round(importacion1516));
                importacion1011 = evaluar(Math.round(importacion1011));
                importacionExento = evaluar(Math.round(importacionExento));
                iva0 = evaluar(Math.round(iva0));
                exento = evaluar(Math.round(exento));
                retencion = evaluar(Math.round(retencion));
                devoluciones = evaluar(Math.round(devoluciones));

                var arrayCampos = new Array();
                arrayCampos.push(iva1516,regionNorte,importacion1516,importacion1011,importacionExento,iva0,exento,retencion,devoluciones);
                var linea;
                var camposVacios = 0;
                for(var i = 0; i < arrayCampos.length; i++){
                    if(arrayCampos[i] == ''){
                        camposVacios = camposVacios + 1;
                    }
                }
                if(camposVacios < 9){
                    linea = tercero+'|'+operacion+'|'+rfc+'|'+taxid+'|'+nombreExtranjero+'|'+pais+'|'+nacionalidad+'|'+iva1516+'|||||'+regionNorte+'|||'+importacion1516+'||'+importacion1011+'||'+importacionExento+'|'+iva0+'|'+exento+'|'+retencion+'|'+devoluciones+'\n';
                }
                else{
                    linea = '';
                }
                arrayTxt.push(linea);
            }

            return arrayTxt;
        }

        /** Funcion que busca los distintos proveedores y tipo de operación en cada una de las transacciones */
        function buscaProveedores(facturasProv, informesGastos, polizasDiario){
            var idProv = new Array();
            if(facturasProv.length != 0){
                for(var i = 0; i < facturasProv.length; i++){
                    if(idProv.length == 0){
                        idProv.push(facturasProv[i].proveedor+facturasProv[i].tipoOperacion);
                    }else{
                        var existe = existeProveedor(idProv, facturasProv[i].proveedor+facturasProv[i].tipoOperacion);
                        if(!existe){
                            idProv.push(facturasProv[i].proveedor+facturasProv[i].tipoOperacion);
                        }
                    }
                }
            }
            if(informesGastos.length != 0){
                for(var i = 0; i < informesGastos.length; i++){
                    if(idProv.length == 0){
                        idProv.push(informesGastos[i].proveedor+informesGastos[i].tipoOperacion);
                    }else{
                        var existe = existeProveedor(idProv, informesGastos[i].proveedor+informesGastos[i].tipoOperacion);
                        if(!existe){
                            idProv.push(informesGastos[i].proveedor+informesGastos[i].tipoOperacion);
                        }
                    }
                }
                
            }
            if(polizasDiario.length != 0){
                for(var i = 0; i < polizasDiario.length; i++){
                    if(idProv.length == 0){
                        idProv.push(polizasDiario[i].proveedor+polizasDiario[i].tipoOperacion);
                    }else{
                        var existe = existeProveedor(idProv, polizasDiario[i].proveedor+polizasDiario[i].tipoOperacion);
                        if(!existe){
                            idProv.push(polizasDiario[i].proveedor+polizasDiario[i].tipoOperacion);
                        }
                    }
                }
            }
            return idProv;
        }

        /** Función que evalua que una variable no sea 0 */
        function evaluar(variable){
            var nvoValor;
            if(variable == 0){
                nvoValor = '';
            }else{
                nvoValor = variable;
            }
            return nvoValor;
        }

        /** Función que busca que no exista el proveedor en una lista de proveedores */
        function existeProveedor(proveedores, proveedor){
            var existe = false;
            for(var x = 0; x < proveedores.length; x++){
                if(proveedor== proveedores[x]){
                    existe = true;
                }
            }
            return existe;
        }

        /** Funcion que busca que no exista el error para no repetirlos */
        function buscarError(error, arrayErrores){
            var errorFlag = false;
            for (var x = 0; x < arrayErrores.length; x++){
                if (error == arrayErrores[x]){
                    errorFlag = true;
                }
            }
            return errorFlag;
        }

        /** Funcion para obtener el dato de acuerdo a la palabra clave */
        function getData (dato, subsidiaria, periodo, fecha){
            var data;
            switch (dato) {
                case 'SUBSIDIARIA':
                    data = subsidiaria;
                    break;
                case 'PERIODO':
                    data = periodo;
                    break;
                case 'DD':
                    data = fecha.getDate();
                    break;
                case 'MM':
                    data = fecha.getMonth() + 1;
                    break;
                case 'YYYY':
                    data = fecha.getFullYear();
                    break;
                case 'HH':
                    data = moment().zone("-06:00").format('HH');
                    break;
                case 'MIN':
                    data = fecha.getMinutes();
                    break;
                case 'SS':
                    data = fecha.getSeconds();
                    break;
                default:
                    break;
            }
            return data;
        }

        /** Funcion para crear una carpeta dentro de la carpeta raíz*/
        function createFolder(nombreSubsidiaria, nombrePeriodo, tipoGuardado, idPadre){
            var nombreFolder = '';
            var folderId;
            var folder;

            if(tipoGuardado == 1) { //guardado por subsidiarias
                nombreFolder = nombreSubsidiaria;
                folder = searchFolderInPath(nombreFolder, idPadre);
                if(folder.runPaged().count != 0){ //existe
                    folder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                }else{ 
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: idPadre
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
            }else if(tipoGuardado == 2) { //guardado por periodo
                nombreFolder = nombrePeriodo;
                folder = searchFolderInPath(nombreFolder, idPadre);
                if(folder.runPaged().count != 0){ //existe
                    folder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                }else{
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: idPadre
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
            }else { //guardado por subsidiaria y periodo
                nombreFolder = nombreSubsidiaria;
                nombreSubfolder = nombrePeriodo;
                var folderSubId;
                folder = searchFolderInPath(nombreFolder, idPadre);
                if(folder.runPaged().count != 0){ //existe folder subsidiaria
                folder.run().each(function(result){
                    folderSubId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                    return true;
                });
                }else{ //se crea folder subsidiaria
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: idPadre
                    });
                    folderSubId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
                log.debug('Folder', folderSubId);
                //se busca el folder periodo dentro del folder subsidiaria
                subfolder = searchFolderInPath(nombreSubfolder, folderSubId);
                if(subfolder.runPaged().count != 0){ //existe
                    subfolder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                }else{
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreSubfolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: folderSubId
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
            }
            return folderId;
        }

        /**
         * Funcion para ver si una carpeta ya existe
         */
        function searchFolder(nombreFolder){
            var folderSearchObj = search.create({
                type: RECORD_INFO.FOLDER_RECORD.ID,
                filters:
                [
                   [RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,search.Operator.IS,nombreFolder]
                ],
                columns:
                [
                    RECORD_INFO.FOLDER_RECORD.FIELDS.ID,
                    RECORD_INFO.FOLDER_RECORD.FIELDS.NAME
                ]
            });
            return folderSearchObj;
        }

        /**
         * Funcion para ver si la carpeta subsidiaria o periodo ya existe dentro de la carpeta raíz
         */
        function searchFolderInPath(nombreFolder, carpetaRaiz){
            var folderSearchObj = search.create({
                type: RECORD_INFO.FOLDER_RECORD.ID,
                filters:
                [
                   [RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,search.Operator.IS,nombreFolder],
                   "AND",
                   [RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT, search.Operator.IS, carpetaRaiz]
                ],
                columns:
                [
                    RECORD_INFO.FOLDER_RECORD.FIELDS.ID,
                    RECORD_INFO.FOLDER_RECORD.FIELDS.NAME
                ]
            });
            return folderSearchObj;
        }
        
        /**
         * Funcion para buscar las facturas de proveedores
         */
        function searchVendorBill(subsidiaria, periodo, suitetax, valores, exentos, iva, retenciones){
            if (suitetax) {
                // cuando el motor es suite tax
                var facturas = [];
                var idPastBill = '', idPastVendor = '';
                var facturaSearch = search.create({
                    type: RECORD_INFO.VENDOR_BILL_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendBill"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"VendBill:B"], //,"VendBill:A" para pruebas
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PERIOD,"abs",periodo], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.FILTER.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"]
                    ],
                    columns:
                    [
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO,
                           join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT,
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_CODE,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_TYPE,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_RATE,
                           join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL,
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR
                    ]
                });
    
                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tercero = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT });
                    var impuestos = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var tipoImpuesto = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var tasa = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var exportacionBienes = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR });
                    var errores = '';

                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);

                    // Se obtienen los datos del proveedor y se obtienen los errores de los campos que hagan falta
                    var datos = buscaDatos(proveedor, tipoTer, errores);
                   
                    //Se realiza la búsqueda de creditos de factura de acuerdo al proveedor y id de factura
                    //solo manda a buscar si es una factura diferente
                    var credito = '';
                    if((proveedor != idPastVendor) && (id != idPastBill)){
                        credito = searchVendorCredit(proveedor, id, suitetax);
                        if (credito.length == 0){
                            credito = '';
                        }
                    }else{
                        credito = '';
                    }

                    idPastBill = id;
                    idPastVendor = proveedor;
    
                    facturas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoImpuesto: tipoImpuesto,
                        tipoDesglose: tipoDesglose,
                        exportacionBienes: exportacionBienes,
                        credito: credito,
                        datos: datos
                    });

                    return true;
                });

                return facturas;

            } else {
                // cuando el motor es legacy
                var facturas = [];
                var idPastBill = '', idPastVendor = '';
                var facturaSearch = search.create({
                    type: RECORD_INFO.VENDOR_BILL_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendBill"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"],
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"VendBill:B"],
                        // "AND", 
                        // ["account",search.Operator.ANYOF,"186"],  
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.FILTER.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PERIOD,"abs",periodo],
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria],
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                    ],
                    columns:
                    [
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                        "type",
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                           join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR,
                        }),
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO,
                           join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NAME,
                           join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ITEM
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR
                    ]
                });
    
                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tercero = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuestos = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NAME, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ITEM });
                    var exportacionBienes = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR });
                    var tasa = 0, errores = '';
    
                    for(var i = 0; i < valores.length; i++){
                        if(valores[i].codeName == taxCode){
                            tasa = valores[i].taxRate;
                        }
                    }

                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                    var datos = buscaDatos(proveedor, tipoTer, errores);
    
                    //Realizar la búsqueda después de agrupar
                    var credito = '';
                    if((proveedor != idPastVendor) && (id != idPastBill)){
                        credito = searchVendorCredit(proveedor, id, suitetax);
                        if (credito.length == 0){
                            credito = '';
                        }
                    }else{
                        credito = '';
                    }

                    idPastBill = id;
                    idPastVendor = proveedor;
    
                    facturas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoDesglose: tipoDesglose,
                        exportacionBienes: exportacionBienes,
                        credito: credito,
                        datos: datos
                    });
    
                    return true;
                });
                return facturas;
                
            }
        }
        /**
         * Funcion para buscar las facturas de proveedores para one world
         */
        function searchVendorBillOW(periodo, suitetax, valores, exentos, iva, retenciones){
            if (suitetax) {
                // cuando el motor es suite tax
                var facturas = [];
                var idPastBill = '', idPastVendor = '';
                var facturaSearch = search.create({
                    type: RECORD_INFO.VENDOR_BILL_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendBill"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"VendBill:B"], //,"VendBill:A" para pruebas
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PERIOD,"abs",periodo],
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.FILTER.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"]
                    ],
                    columns:
                    [
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO,
                           join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT,
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_CODE,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_TYPE,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_RATE,
                           join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL,
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR
                    ]
                });
    
                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tercero = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT });
                    var impuestos = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var tipoImpuesto = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var tasa = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var exportacionBienes = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR });
                    var errores = '';

                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);

                    // Se obtienen los datos del proveedor y se obtienen los errores de los campos que hagan falta
                    var datos = buscaDatos(proveedor, tipoTer, errores);
                   
                    //Se realiza la búsqueda de creditos de factura de acuerdo al proveedor y id de factura
                    //solo manda a buscar si es una factura diferente
                    var credito = '';
                    if((proveedor != idPastVendor) && (id != idPastBill)){
                        credito = searchVendorCredit(proveedor, id, suitetax);
                        if (credito.length == 0){
                            credito = '';
                        }
                    }else{
                        credito = '';
                    }

                    idPastBill = id;
                    idPastVendor = proveedor;
    
                    facturas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoImpuesto: tipoImpuesto,
                        tipoDesglose: tipoDesglose,
                        exportacionBienes: exportacionBienes,
                        credito: credito,
                        datos: datos
                    });

                    return true;
                });

                return facturas;

            } else {
                // cuando el motor es legacy
                var facturas = [];
                var idPastBill = '', idPastVendor = '';
                var facturaSearch = search.create({
                    type: RECORD_INFO.VENDOR_BILL_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendBill"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"],
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"VendBill:B"],
                        // "AND", 
                        // ["account",search.Operator.ANYOF,"186"],  
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.FILTER.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PERIOD,"abs",periodo],
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                    ],
                    columns:
                    [
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                        "type",
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                           join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR,
                        }),
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO,
                           join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NAME,
                           join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ITEM
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR
                    ]
                });
    
                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tercero = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuestos = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NAME, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ITEM });
                    var exportacionBienes = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR });
                    var tasa = 0, errores = '';
    
                    for(var i = 0; i < valores.length; i++){
                        if(valores[i].codeName == taxCode){
                            tasa = valores[i].taxRate;
                        }
                    }

                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                    var datos = buscaDatos(proveedor, tipoTer, errores);
    
                    //Realizar la búsqueda después de agrupar
                    var credito = '';
                    if((proveedor != idPastVendor) && (id != idPastBill)){
                        credito = searchVendorCredit(proveedor, id, suitetax);
                        if (credito.length == 0){
                            credito = '';
                        }
                    }else{
                        credito = '';
                    }

                    idPastBill = id;
                    idPastVendor = proveedor;
    
                    facturas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoDesglose: tipoDesglose,
                        exportacionBienes: exportacionBienes,
                        credito: credito,
                        datos: datos
                    });
    
                    return true;
                });
                return facturas;
                
            }
        }

        /**
         * Funcion para buscar los informes de gastos
         */
        function searchExpenseReports(subsidiaria, periodo, suitetax, valores, exentos, iva, retenciones){

            if(suitetax){   
                var informes = [];
                var informesSearch = search.create({
                    type: RECORD_INFO.EXPENSE_REPORT_RECORD.ID,
                    filters:
                    [
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"ExpRept"], 
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"],
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"ExpRept:I"], 
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PERIOD,"abs",periodo], 
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria], 
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"],
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"]
                    ],
                    columns:
                    [
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID,
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR,
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT,
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                          name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE,
                          join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                          name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_TYPE,
                          join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_RATE,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                        }),
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION
                    ],
                });

                informesSearch.run().each(function(result){

                    var id = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT });
                    var impuestos = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                    var tipoImpuesto = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                    var importacionBienes = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION });
                    var tasa = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                    var errores = ''; 

                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                    var datos = buscaDatos(proveedor, tipoTer, errores);
    
                    informes.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoImpuesto: tipoImpuesto,
                        tipoDesglose: tipoDesglose,
                        importacionBienes: importacionBienes,
                        datos: datos
                    });

                    return true;
                });
    
                return informes;     
            } else {
                var informes = [];
                var informesSearch = search.create({
                    type: RECORD_INFO.EXPENSE_REPORT_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"ExpRept"], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.MAINLINE,search.Operator.ANY,""], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"ExpRept:I"],
                        // "AND", 
                        // ["account",search.Operator.ANYOF,"186"],   
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"2","1","3"],
                        "AND",
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PERIOD,"abs",periodo], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                    ],
                    columns:
                    [
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION
                    ]
                });
                informesSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    //var operacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var operacion = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuestos = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE });
                    var importacionBienes = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION });
                    var tasa = 0, errores = '';

                    for(var i = 0; i < valores.length; i++){
                        if(valores[i].codeName == taxCode){
                            tasa = valores[i].taxRate;
                        }
                    }

                    /* Obtener la tasa con la columna no con fórmula */
                    //tasa = calculaIVA(impuestos, importe, tasa);
                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                    var datos = buscaDatos(proveedor, tipoTer, errores);

                    // errores = datos[0].errores;
    
                    informes.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoDesglose: tipoDesglose,
                        importacionBienes: importacionBienes,
                        datos: datos
                    });
    
                    return true;
                });
    
                return informes;
            }
        }

         /**
         * Funcion para buscar los informes de gastos
         */
        function searchExpenseReportsOW(periodo, suitetax, valores, exentos, iva, retenciones){

            if(suitetax){   
                var informes = [];
                var informesSearch = search.create({
                    type: RECORD_INFO.EXPENSE_REPORT_RECORD.ID,
                    filters:
                    [
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"ExpRept"], 
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"],
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"ExpRept:I"], 
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PERIOD,"abs",periodo],
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"],
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                       "AND", 
                       [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"]
                    ],
                    columns:
                    [
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID,
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR,
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT,
                       RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                          name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE,
                          join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                          name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_TYPE,
                          join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_RATE,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                        }),
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION
                    ],
                });

                informesSearch.run().each(function(result){

                    var id = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT });
                    var impuestos = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                    var tipoImpuesto = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                    var importacionBienes = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION });
                    var tasa = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                    var errores = ''; 

                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                    var datos = buscaDatos(proveedor, tipoTer, errores);
    
                    informes.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoImpuesto: tipoImpuesto,
                        tipoDesglose: tipoDesglose,
                        importacionBienes: importacionBienes,
                        datos: datos
                    });

                    return true;
                });
    
                return informes;     
            } else {
                var informes = [];
                var informesSearch = search.create({
                    type: RECORD_INFO.EXPENSE_REPORT_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"ExpRept"], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.MAINLINE,search.Operator.ANY,""], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"ExpRept:I"],
                        // "AND", 
                        // ["account",search.Operator.ANYOF,"186"],   
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"2","1","3"],
                        "AND",
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PERIOD,"abs",periodo],
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                    ],
                    columns:
                    [
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION
                    ]
                });
                informesSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    //var operacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                    var operacion = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuestos = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE });
                    var importacionBienes = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION });
                    var tasa = 0, errores = '';

                    for(var i = 0; i < valores.length; i++){
                        if(valores[i].codeName == taxCode){
                            tasa = valores[i].taxRate;
                        }
                    }

                    /* Obtener la tasa con la columna no con fórmula */
                    //tasa = calculaIVA(impuestos, importe, tasa);
                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                    var datos = buscaDatos(proveedor, tipoTer, errores);

                    // errores = datos[0].errores;
    
                    informes.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoDesglose: tipoDesglose,
                        importacionBienes: importacionBienes,
                        datos: datos
                    });
    
                    return true;
                });
    
                return informes;
            }
        }

        /**
         * Funcion para buscar las polizas de diario
         */
        function searchDailyPolicy(subsidiaria, periodo, suitetax, valCodigos, exentos, iva, retenciones){

            if(suitetax){
                var polizas = []
                var polizasSearch = search.create({
                    type: RECORD_INFO.JOURNAL_ENTRY_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"Journal"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"Journal:B"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PERIOD,"abs",periodo], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"]
                    ],
                    columns:
                    [
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_TOTAL,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION
                    ]
                });
                polizasSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importacionBienes = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION });
                    var cuenta = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT });
                    var importe = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT }); //importe negativo = crédito, importe positivo = débito
                    var impuestos = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_TOTAL });
                    var errores = '';

                    // Se manda llamar a la función para la búsqueda de código, tipo y tasa de impuesto
                    var codigos = searchTaxCode(suitetax, cuenta, valCodigos, exentos, iva, retenciones);

                    //Se obtiene el desglose de impuesto de acuerdo al código de impuesto
                    /* var tipoDesglose;
                    for (var i = 0; i < codigos.length; i++){
                        tipoDesglose = buscaDesgloseImpuesto(codigos[i].taxCode, exentos, iva, retenciones);
                    } */

                    //Si la cuenta no tiene un código y/o tipo de impuesto asociado, no se toma en cuenta
                    if(codigos.length != 0){
                        var datos = buscaDatos(proveedor, tipoTer, errores);
        
                        polizas.push({
                            id: id,
                            proveedor: proveedor,
                            tipoTercero: tipoTercero,
                            tipoOperacion: tipoOperacion,
                            importacionBienes: importacionBienes,
                            cuenta: cuenta,
                            importe: importe,
                            impuestos: impuestos,
                            codigos: codigos,
                            datos: datos
                        });
                    }
                    return true;
                });
    
                return polizas;
            }else {
                var polizas = []
                var polizasSearch = search.create({
                    type: RECORD_INFO.JOURNAL_ENTRY_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"Journal"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.MAINLINE,search.Operator.ANY,""],
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"Journal:B"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PERIOD,"abs",periodo], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                    ],
                    columns:
                    [
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                           name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NAME,
                           join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ITEM
                        }),
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION
                    ]
                });
                polizasSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR });
                    var cuenta = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT });
                    var tipoTer = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuestos = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NAME, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ITEM });
                    var importacionBienes = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION });
                    var tasa = '', errores = '', tipoDesglose = '', codigos = '';

                    var datos = buscaDatos(proveedor, tipoTer, errores);

                    //si no tiene un codigo de impuesto, se busca en base a la cuenta
                    if(taxCode == ''){
                        codigos = searchTaxCode(suitetax, cuenta, valCodigos, exentos, iva, retenciones);
                    }else{
                        for(var i = 0; i < valCodigos.length; i++){
                            if(valCodigos[i].codeName == taxCode){
                                tasa = valCodigos[i].taxRate;
                            }
                        }
                        tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                    }

                    polizas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importacionBienes: importacionBienes,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoDesglose: tipoDesglose,
                        codigos: codigos,
                        datos: datos
                    });

                    //Se obtiene el desglose de impuesto de acuerdo al código de impuesto
                    /* var tipoDesglose;
                    for (var i = 0; i < codigos.length; i++){
                        tipoDesglose = buscaDesgloseImpuesto(codigos[i].taxCode, exentos, iva, retenciones);
                    } */
                    
                    return true;
                });

                return polizas;
            }
        }

        /**
         * Funcion para buscar las polizas de diario
         */
        function searchDailyPolicyOW(periodo, suitetax, valCodigos, exentos, iva, retenciones){

            if(suitetax){
                var polizas = []
                var polizasSearch = search.create({
                    type: RECORD_INFO.JOURNAL_ENTRY_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"Journal"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"Journal:B"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PERIOD,"abs",periodo],
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"]
                    ],
                    columns:
                    [
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_TOTAL,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION
                    ]
                });
                polizasSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importacionBienes = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION });
                    var cuenta = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT });
                    var importe = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT }); //importe negativo = crédito, importe positivo = débito
                    var impuestos = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_TOTAL });
                    var errores = '';

                    // Se manda llamar a la función para la búsqueda de código, tipo y tasa de impuesto
                    var codigos = searchTaxCode(suitetax, cuenta, valCodigos, exentos, iva, retenciones);

                    //Se obtiene el desglose de impuesto de acuerdo al código de impuesto
                    /* var tipoDesglose;
                    for (var i = 0; i < codigos.length; i++){
                        tipoDesglose = buscaDesgloseImpuesto(codigos[i].taxCode, exentos, iva, retenciones);
                    } */

                    //Si la cuenta no tiene un código y/o tipo de impuesto asociado, no se toma en cuenta
                    if(codigos.length != 0){
                        var datos = buscaDatos(proveedor, tipoTer, errores);
        
                        polizas.push({
                            id: id,
                            proveedor: proveedor,
                            tipoTercero: tipoTercero,
                            tipoOperacion: tipoOperacion,
                            importacionBienes: importacionBienes,
                            cuenta: cuenta,
                            importe: importe,
                            impuestos: impuestos,
                            codigos: codigos,
                            datos: datos
                        });
                    }
                    return true;
                });
    
                return polizas;
            }else {
                var polizas = []
                var polizasSearch = search.create({
                    type: RECORD_INFO.JOURNAL_ENTRY_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"Journal"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.MAINLINE,search.Operator.ANY,""],
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"Journal:B"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PERIOD,"abs",periodo],
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                    ],
                    columns:
                    [
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                           name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NAME,
                           join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ITEM
                        }),
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION
                    ]
                });
                polizasSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR });
                    var cuenta = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT });
                    var tipoTer = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = operacion.split(' ',1);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuestos = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NAME, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ITEM });
                    var importacionBienes = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION });
                    var tasa = '', errores = '', tipoDesglose = '', codigos = '';

                    var datos = buscaDatos(proveedor, tipoTer, errores);

                    //si no tiene un codigo de impuesto, se busca en base a la cuenta
                    if(taxCode == ''){
                        codigos = searchTaxCode(suitetax, cuenta, valCodigos, exentos, iva, retenciones);
                    }else{
                        for(var i = 0; i < valCodigos.length; i++){
                            if(valCodigos[i].codeName == taxCode){
                                tasa = valCodigos[i].taxRate;
                            }
                        }
                        tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                    }

                    polizas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importacionBienes: importacionBienes,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoDesglose: tipoDesglose,
                        codigos: codigos,
                        datos: datos
                    });

                    //Se obtiene el desglose de impuesto de acuerdo al código de impuesto
                    /* var tipoDesglose;
                    for (var i = 0; i < codigos.length; i++){
                        tipoDesglose = buscaDesgloseImpuesto(codigos[i].taxCode, exentos, iva, retenciones);
                    } */
                    
                    return true;
                });

                return polizas;
            }
        }

        /**
         * Función que realiza la búsqueda de distintos campos de acuerdo a cada proveedor
         * @param {*} proveedor Proveedor obtenido de cada operación
         * @param {*} tipoTercero Tipo de tercero del proveedor
         * @param {*} errores Errores que se almacenan de acuerdo a las validaciones
         * @returns Los valores de los campos obtenidos y los errores encontrados
         */
        function buscaDatos(proveedor, tipoTercero, errores){

            var error = '', resultados = [];
            var datos = search.lookupFields({
                type: search.Type.VENDOR,
                id: proveedor,
                columns: [RECORD_INFO.VENDOR_RECORD.FIELDS.RFC, RECORD_INFO.VENDOR_RECORD.FIELDS.TAX_ID , RECORD_INFO.VENDOR_RECORD.FIELDS.NOMBRE_EXTRANJERO, RECORD_INFO.VENDOR_RECORD.FIELDS.PAIS_RESIDENCIA, RECORD_INFO.VENDOR_RECORD.FIELDS.NACIONALIDAD, RECORD_INFO.VENDOR_RECORD.FIELDS.NAME]
            });

            var rfc = datos[RECORD_INFO.VENDOR_RECORD.FIELDS.RFC];
            var taxID = datos[RECORD_INFO.VENDOR_RECORD.FIELDS.TAX_ID];
            var nombreExtranjero = datos[RECORD_INFO.VENDOR_RECORD.FIELDS.NOMBRE_EXTRANJERO];
            var paisResidencia = datos[RECORD_INFO.VENDOR_RECORD.FIELDS.PAIS_RESIDENCIA];
            var nombreProv = datos[RECORD_INFO.VENDOR_RECORD.FIELDS.NAME];
            if(paisResidencia.length != 0){
                var paisText = paisResidencia[0].text;
                var pais = paisText.split(' ',1);
                pais = pais.toString();
                paisResidencia = pais;
            }else {
                paisResidencia = "";
            }
            var nacionalidad = datos[RECORD_INFO.VENDOR_RECORD.FIELDS.NACIONALIDAD];

            if (tipoTercero == 1){ //si es proveedor nacional -> RFC obligatorio
                if(rfc == ''){
                    error = "El proveedor " + nombreProv + " no tiene asignado el RFC";
                    errores = errores + error + "/";
                }
                /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                taxID = "";
                nombreExtranjero = "";
                paisResidencia = "";
                nacionalidad = "";
            } else if (tipoTercero == 2){ // si es proveedor extranjero -> RFC opcional, TaxID obligatorio, nombreExtranjero opcional
                if(taxID == ''){
                    error = "El proveedor " + nombreProv + " no tiene asignado el número de ID Fiscal";
                    errores = errores + error + "/";
                }
                /** Si tiene asignado un valor el campo nombre extranjero, se tiene que tener el pais y la nacionalidad */
                if (nombreExtranjero != ""  && paisResidencia == ""){
                    error = "El proveedor " + nombreProv + " no tiene asignado el pais de residencia";
                    errores = errores + error + "/";
                }
                if(nombreExtranjero != "" && nacionalidad == ""){
                    error = "El proveedor " + nombreProv + " no tiene asignada la nacionalidad";
                    errores = errores + error + "/";
                }
                /** Si no tiene un valor en nombre extranjero los otros campos no importan */
                if(nombreExtranjero == ""){ 
                    paisResidencia = "";
                    nacionalidad = "";
                }
            } else { //si es proveedor global -> RFC NO obligatorio
                /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                rfc = "";
                taxID = "";
                nombreExtranjero = "";
                paisResidencia = "";
                nacionalidad = "";
            }

            resultados. push({
                rfc: rfc,
                taxID, taxID,
                nombreExtranjero: nombreExtranjero,
                paisResidencia: paisResidencia,
                nacionalidad: nacionalidad,
                errores: errores
            });

            return resultados;
        }

        /**
         * Función que busca el desglose de impuesto de acuerdo al código de impuesto
         * @param {*} codigo Codigo de impuesto a buscar en el desglose
         * @param {*} exentos Desglose de impuestos exentos
         * @param {*} iva Desglose de impuestos con iva
         * @param {*} retenciones Desglose de impuestos con retenciones
         * @returns El nombre del impuesto al que corresponde
         */
        function buscaDesgloseImpuesto(codigo, exentos, iva, retenciones){
            var desglose = '';
            if(exentos.length != 0){
                for(var i = 0; i < exentos.length; i++){
                    if(codigo == exentos[i].text){
                        desglose = 'Exento';
                        break;
                    }
                }
            }
            if(iva.length != 0){
                for(var i = 0; i < iva.length; i++){
                    if(codigo == iva[i].text){
                        desglose = 'Iva';
                        break;
                    }
                }
            }
            if(retenciones.length != 0){
                for(var i = 0; i < retenciones.length; i++){
                    if(codigo == retenciones[i].text){
                        desglose = 'Retenciones';
                        break;
                    }
                }
            }

            return desglose;
        }

        /**
         * Funcion que hace una búsqueda de devoluciones o bonificaciones de algún proveedor
         */
        function searchVendorCredit(proveedor, idFactProv, suitetax){
            if(suitetax){
                var credito = [], proveedorC = '', idFact = '', idC = '';
                var creditSearch = search.create({
                    type: RECORD_INFO.VENDOR_CREDIT_RECORD.ID,
                    filters:
                    [
                       [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendCred"], 
                       "AND", 
                       [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"],
                       "AND", 
                       [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                       "AND", 
                       [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.FILTER.PROVEEDOR,search.Operator.ANYOF,proveedor]
                    ],
                    columns:
                    [
                       RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                       RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ENTITY,
                       RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TOTAL,
                       RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TOTAL,
                       search.createColumn({
                          name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                          join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION
                       }),
                       search.createColumn({
                          name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_CODE,
                          join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL
                       }),
                       search.createColumn({
                          name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TYPE,
                          join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL
                       }),
                       search.createColumn({
                          name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_RATE,
                          join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL
                       })
                    ]
                });

                creditSearch.run().each(function(result){

                    var id = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ENTITY });
                    var idFactura = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION });
                    var impuesto = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TOTAL });
                    var total = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TOTAL });
                    var taxCode = result.getText({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL });
                    var tipoImpuesto = result.getText({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL });
                    var tasa = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL });
                    total = -1 * (total);
                    var importe = total - impuesto;

                    if(idFactProv == idFactura || idFactProv == idFact){
                        
                        if (proveedor != '' || idFactura != ''){
                            proveedorC = proveedor;
                            idFact = idFactura;
                        }
    
                        if (idFactProv == idFact){
                            if ((idC == id) && (taxCode != '') && (tipoImpuesto != '')){
                            
                                credito.push({
                                    id: id,
                                    proveedor: proveedorC,
                                    idFactura: idFact,
                                    importe: importe,
                                    impuesto: impuesto,
                                    total: total,
                                    taxCode: taxCode,
                                    tipoImpuesto: tipoImpuesto,
                                    tasa: tasa
                                });
                            }
                        }
    
                        idC = id;
                    }

                    
                    return true;
                });
                
                return credito;
            }else{
                var credito = [];
                var creditSearch = search.create({
                    type: RECORD_INFO.VENDOR_CREDIT_RECORD.ID,
                    filters:
                    [
                       [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendCred"], 
                       "AND", 
                       [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                       "AND", 
                       [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"], 
                       "AND", 
                       [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                       "AND", 
                       [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.FILTER.PROVEEDOR,search.Operator.ANYOF,proveedor], 
                       "AND", 
                       [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.FILTER.TRANSACTION,search.Operator.ANYOF,idFactProv]
                    ],
                    columns:
                    [
                       RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                       RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TIPO_OPERACION,
                       search.createColumn({
                          name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TIPO_TERCERO,
                          join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.PROVEEDOR
                       }),
                       search.createColumn({
                          name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                          join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION
                       }),
                       RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                       RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_AMOUNT
                    ]
                });
                creditSearch.run().each(function(result){
                    
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID });
                    var tipoOperacion = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoTercero = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.PROVEEDOR });
                    var idFactura = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION });
                    var importe = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuesto = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_AMOUNT });
    
                    credito.push({
                        id: id,
                        proveedor: proveedor,
                        tipoOperacion:tipoOperacion,
                        tipoTercero: tipoTercero,
                        idFactura: idFactura,
                        importe: importe,
                        impuesto: impuesto
                    });
                    
                    return true;
                });
                
                return credito; 
            }
        }

        /**
         * Función que busca el código y tipo de impuesto para las pólizas
         * @param {*} suitetax Motor (legacy o suitetax)
         * @param {*} cuenta Cuenta de la línea de póliza a comparar con las cuentas asociadas a códigos de impuesto
         * @param {*} valCodigos Registro de los códigos con tipo de impuesto y tasa
         * @returns Codigo y tipo de impuesto
         */
        function searchTaxCode(suitetax, cuenta, valCodigos, exentos, iva, retenciones){
            if(suitetax){
                var codigos = [];
                var codigoSearch = search.create({
                    type: RECORD_INFO.SALES_TAX_ITEM_RECORD.ID,
                    filters:
                    [
                       [RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.COUNTRY,search.Operator.ANYOF,"MX"]
                    ],
                    columns:
                    [
                       RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.ID,
                       RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME,
                       search.createColumn({
                          name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME,
                          join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                       }),
                       search.createColumn({
                          name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.RECEIVABLES_ACCOUNT,
                          join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                       }),
                       search.createColumn({
                          name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.PAYABLES_ACCOUNT,
                          join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                       })
                    ]
                 });
                codigoSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.ID });
                    var taxCode = result.getValue({ name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME });
                    var tipoImpuesto = result.getValue({ name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME, join:RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE });
                    var cuenta1 = result.getValue({ name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.RECEIVABLES_ACCOUNT, join:RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE });
                    var cuenta2 = result.getValue({ name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.PAYABLES_ACCOUNT, join:RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE });
                    var tasa;

                    /** Se realiza un recorrido en el arreglo de valores y se ve si el id coincide con el código de impuesto para obtener los datos*/
                    for(var i = 0; i < valCodigos.length; i++){
                        if(valCodigos[i].codeName == taxCode){
                            tasa = valCodigos[i].taxRate;
                        }
                    }

                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                    /** Si la cuenta coincide con una de las asociadas con un código de impuestos */
                    if (cuenta == cuenta1 || cuenta == cuenta2){
                        //Se verifica que no sea iva 0 o exentos
                        if(tipoDesglose != 'Exento'){
                            if((tipoDesglose == 'Iva' && tasa != 0) || (tipoDesglose == 'Retenciones')){
                                codigos.push({
                                    id: id,
                                    taxCode: taxCode,
                                    tipoImpuesto: tipoImpuesto,
                                    tasa: tasa,
                                    tipoDesglose: tipoDesglose
                                });
                            }
                        }
                    }

                    return true;
                });
                return codigos;
            }else{
                var codigos = [];
                var codigoSearch = search.create({
                    type: "salestaxitem",
                    filters:
                    [
                       ["country","anyof","MX"]
                    ],
                    columns:
                    [
                       "internalid",
                       "name",
                       "rate",
                       "taxtype",
                       "purchaseaccount",
                       "saleaccount"
                    ]
                 });
                codigoSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var taxCode = result.getValue({ name: 'name' });
                    //var tasa = result.getValue({ name: 'rate' });
                    var tipoImpuesto = result.getValue({ name: 'taxtype' });
                    var cuenta1 = result.getValue({ name: 'purchaseaccount' });
                    var cuenta2 = result.getValue({ name: 'saleaccount' });
                    var tasa;

                    for(var i = 0; i < valCodigos.length; i++){
                        if(valCodigos[i].codeName == taxCode){
                            tasa = valCodigos[i].taxRate;
                        }
                    }

                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);

                    if(cuenta == cuenta1 || cuenta == cuenta2){
                        //Se verifica que no sea iva 0 o exentos
                        if(tipoDesglose != 'Exento'){
                            if((tipoDesglose == 'Iva' && tasa != 0) || (tipoDesglose == 'Retenciones')){
                                codigos.push({
                                    id: id,
                                    taxCode: taxCode,
                                    tipoImpuesto: tipoImpuesto,
                                    tasa: tasa,
                                    tipoDesglose: tipoDesglose
                                });
                            }
                        }
                    }

                    return true;
                });
                
                return codigos;
            }
        }

        /**
         * Función que busca los códigos de impuesto
         * @param {*} suitetax Motor (legacy o suitetax)
         * @returns Búsqueda con todas las columnas
         */
        function searchCodigoImpuesto(suitetax){
            if(suitetax){
                var codigoSearch = search.create({
                    type: RECORD_INFO.SALES_TAX_ITEM_RECORD.ID,
                    filters:
                    [
                       [RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.COUNTRY,search.Operator.ANYOF,"MX"]
                    ],
                    columns:
                    [
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.ID,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME,
                        search.createColumn({
                            name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME,
                            join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                        }),
                        search.createColumn({
                            name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.RECEIVABLES_ACCOUNT,
                            join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                        }),
                        search.createColumn({
                            name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.PAYABLES_ACCOUNT,
                            join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                        })
                    ]
                });
                return codigoSearch;
            }else{
                var codigoSearch = search.create({
                    type: RECORD_INFO.SALES_TAX_ITEM_RECORD.ID,
                    filters:
                    [
                       [RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.COUNTRY,search.Operator.ANYOF,"MX"]
                    ],
                    columns:
                    [
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.ID,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.RATE,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.PURCHASE_ACCOUNT,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.SALE_ACCOUNT
                    ]
                });
                return codigoSearch;
            }
        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {
            try {
                /* log.debug('Summary Time', summaryContext.seconds);
                log.debug('Summary Usage', summaryContext.usage);
                log.debug('Summary Yields', summaryContext.yields);
    
                log.debug('Input Summary', summaryContext.inputSummary);
                log.debug('Map Summary', summaryContext.mapSummary);
                log.debug('Reduce Summary', summaryContext.reduceSummary); */
    
                /** Cuando ya termine, enviar correo notificando al usuario */
                var objScript = runtime.getCurrentScript();
                var notificar = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.NOTIFICAR });
                log.debug('Notificar', notificar);
                // se obtiene el correo del usuario que ejecuto
                var userObj = runtime.getCurrentUser();
                log.debug('Current user email: ' , userObj.email);
    
                if(notificar){
                    email.send({
                        author: userObj.id,
                        recipients: userObj.email,
                        subject: 'DIOT',
                        body: 'El proceso de la DIOT ha terminado',
                    });
                }
            } catch (error) {
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en el envío de correo', details: error })
            }
        }


        return {getInputData, map, reduce, summarize};

    });
