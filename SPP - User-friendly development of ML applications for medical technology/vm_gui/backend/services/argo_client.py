from pathlib import Path
import yaml
import requests
import base64
from hera.workflows import Workflow, DAG, Task, Parameter, Artifact, Env
from hera.workflows.models import TemplateRef, LocalObjectReference
from hera.shared import GlobalConfig

TEMPLATES_DIR = Path(__file__).parent.parent / "templates_yaml"
ARGO_API_URL = "https://argowf.hpc.wzl-iqs.rwth-aachen.de/api/v1"
NAMESPACE = "virtual-measurement"

ALWAYS_REQUIRED_PARAMS = [
    'input_path', 
    'output_path', 
    'data_path', 
    'input_file', 
    'output_file'
]

def decode_base64(encoded_string):
    """
    Decodes a Base64 string into a UTF-8 string.

    Args:
        encoded_string (str): The Base64 encoded string to decode.

    Returns:
        str: The decoded plain-text string.
    """
    decoded_bytes = base64.b64decode(encoded_string.encode("utf-8"))
    return decoded_bytes.decode("utf-8")


def load_token(token_file="token_secret.yaml"):
    """
    Loads, decodes, and formats the Bearer token from a YAML file.

    This token is required for all authenticated HTTP requests to the Argo API.

    Args:
        token_file (str): Path to the YAML file containing the encoded "Bearer" key. 
            Defaults to "token_secret.yaml".

    Returns:
        str: The fully formatted string "Bearer <token>" for Authorization headers.
    """
    with open(token_file, "r") as f:            
        token = yaml.safe_load(f)["Bearer"]     #Bearer token
    token = decode_base64(token)
    return "Bearer " + token

def get_workflow_template(token, workflow_name):
    url = f"{ARGO_API_URL}/workflow-templates/{NAMESPACE}/{workflow_name}"  #Hier wird gesucht
    headers = {"Authorization": token}
    r = requests.get(url, headers=headers)
    r.raise_for_status()  # Exception if HTTP error
    return r.json()

def get_all_template_names(token):
    """
    Retrieves the names of all workflow templates available in the Argo namespace.

    This function queries the Argo API to get a list of all template objects and 
    extracts only the metadata name for each.

    Args:
        token (str): The formatted Bearer authorization token for the API request.

    Returns:
        list[str]: A list containing only the names of the workflow templates.
    """
    url = f"{ARGO_API_URL}/workflow-templates/{NAMESPACE}"  # All
    headers = {"Authorization": token}
    r = requests.get(url, headers=headers)
    r.raise_for_status()
    
    data = r.json()  #r als Python dict
    names = [item['metadata']['name'] for item in data.get('items', [])]    #Only 'name'
    return names

def extract_available_entrypoints(workflow_template):
    """
    Extracts all template names from a workflow template's specification.

    This identifies the available sub-templates (entrypoints) within a YAML file, 
    such as 'fit', 'transform', or 'inverse'.

    Args:
        workflow_template (dict): The raw workflow template dictionary retrieved from Argo.

    Returns:
        list[str]: A list of names for all defined sub-templates. Returns an empty 
            list if an error occurs or no templates are found.
    """
    try:
        spec = workflow_template.get('spec', {})
        # Liste alle definierte sub-templates finden
        templates = spec.get('templates', [])
        
        # Liste alle strings unter "name" zurueckgeben
        return [t.get('name') for t in templates if 'name' in t]
    except Exception:
        return []

def get_template_details_logic(workflow_template, selected_entrypoint):
    """
    Parses a raw Argo template to extract the input/output schema for a specific entrypoint.

    This function implements the logic to determine if a parameter is required by checking:
    1. Local defaults defined in the template input.
    2. Global arguments defined in the workflow spec.
    3. A hardcoded list of mandatory fields (ALWAYS_REQUIRED_PARAMS).

    Args:
        workflow_template (dict): The complete workflow definition parsed from YAML.
        selected_entrypoint (str): The specific template name to inspect (e.g., 'fit').

    Returns:
        dict: A dictionary containing lists of 'parameters', 'artifacts', and 'outputs'.
              Returns None if the entrypoint is not found in the template.
    """
    spec = workflow_template.get('spec', {})
    templates = spec.get('templates', [])
    
    # 1. Defaults (spec.arguments.parameters.name hat value)
    global_args = {}
    if 'arguments' in spec and 'parameters' in spec['arguments']:
        for param in spec['arguments']['parameters']:
            global_args[param['name']] = param.get('value')  #Es gibt aber values mit leeren String: ""

    # 2. entrypoint suchen
    target = next((t for t in templates if t.get('name') == selected_entrypoint), None)
    
    if not target:
        return None

    inputs_data = target.get('inputs', {})
    outputs_data = target.get('outputs', {})

    # 3. PARAMETERS (Local + Global)
    parameters = []
    # templates.name.inputs.parameters
    raw_params = inputs_data.get('parameters', []) 
    
    for p in raw_params:    #inputs
        p_name = p['name']
        
        # Prioritiy logik:
        # 1. Default definiert in input vom template (local)
        # 2. Default definiert in global arguments (global)
        # 3. None
        
        # templates.name.inputs.parameters.default (fall z.B "dag-process-timeseries-v1.0.5")
        local_default = p.get('default')
        global_default = global_args.get(p_name)
        
        final_default = local_default if local_default is not None else global_default
        
        is_technically_required = final_default is None
        is_forced_required = p_name.lower() in [k.lower() for k in ALWAYS_REQUIRED_PARAMS]
        
        is_required = is_technically_required or is_forced_required

        parameters.append({
            "name": p_name,
            "default": final_default,
            "required": is_required, 
            "type": "parameter"
        })

    # 4. ARTIFACTS
    artifacts = []
    # templates.name.inputs.artifiacts
    for a in inputs_data.get('artifacts', []):
        is_optional = a.get('optional', False)
        artifacts.append({
            "name": a['name'],
            "required": not is_optional,
            "type": "artifact"
        })

    # 5. OUTPUTS 
    outputs = []
    # templates.name.outputs.artifiacts
    for o in outputs_data.get('artifacts', []):
        outputs.append({
            "name": o['name'],
            "type": "artifact"
        })

    return {
        "parameters": parameters,
        "artifacts": artifacts,
        "outputs": outputs
    }

def submit_hera_workflow(nodes, edges, s3_config=None, action="submit"):
    """
    Orchestrates the construction and submission of an Argo Workflow using the Hera SDK.

    This core function translates the abstract graph (nodes and edges) received from the 
    frontend into a concrete Kubernetes Workflow. It performs the following steps:
    1.  **Configuration**: Sets up the global Argo client and injects S3 credentials as 
        environment variables for every task.
    2.  **Task Creation**: Iterates through `nodes` to create Hera tasks, mapping user 
        arguments to template parameters.
    3.  **Linking**: Iterates through `edges` to define execution order (`>>`) and passes 
        artifacts dynamically from source outputs to target inputs.
    4.  **Validation**: Checks if all required parameters are either manually filled or 
        connected via an edge before submission.

    Args:
        nodes (list[dict]): List of node objects containing 'id', 'template_name', 
            'entrypoint', and user-defined 'arguments'.
        edges (list[dict]): List of connections with 'source' and 'target' node IDs.
        s3_config (dict, optional): S3 access credentials (endpoint, accessKey, secretKey) 
            to be injected into the container environment. Defaults to None.
        action (str, optional): The execution mode. 
            - 'submit': Deploys the workflow to the cluster (default).
            - 'download': Returns the generated YAML string without deploying.

    Returns:
        str: The generated YAML string (if action='download') OR the unique name of the 
        submitted workflow (if action='submit').

    Raises:
        ValueError: If the validation logic detects missing required parameters or artifacts.
    """
    raw_token = load_token().replace("Bearer ", "").strip()
    full_token = load_token()
    
    GlobalConfig.host = "https://argowf.hpc.wzl-iqs.rwth-aachen.de"
    GlobalConfig.token = raw_token
    GlobalConfig.verify_ssl = True

    template_specs_cache = {}

    def get_node_spec(template_name, entrypoint):
        key = f"{template_name}_{entrypoint}"
        if key not in template_specs_cache:
            wf = get_workflow_template(full_token, template_name)
            details = get_template_details_logic(wf, entrypoint)
            template_specs_cache[key] = details
        return template_specs_cache[key]

    #-- S3 CREDENTIALS --
    # AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY sind AWS-Standard; 
    # AWS_ENDPOINT_URL oder S3_ENDPOINT_URL (eigene Konvention) ??

    s3_env_vars = []
    if s3_config and s3_config.get('accessKey'):
        s3_env_vars = [
            Env(name="AWS_ACCESS_KEY_ID", value=s3_config['accessKey']),
            Env(name="AWS_SECRET_ACCESS_KEY", value=s3_config['secretKey']),
            Env(name="S3_ENDPOINT_URL", value=s3_config.get('endpoint', 'https://s3.rwth-aachen.de'))
        ]

    with Workflow(
        generate_name="vm-gui-job-", 
        namespace=NAMESPACE, 
        entrypoint="main-dag",
        image_pull_secrets=[LocalObjectReference(name="vm-pipeline-image-pull-secret")]
    ) as w:
        with DAG(name="main-dag"):
            hera_tasks = {}

            # ---------------------------------------------------------
            # 1: PARAMETERS
            # ---------------------------------------------------------
            for node in nodes:
                node_id = node['id']

                spec = get_node_spec(node['template_name'], node['entrypoint'])
                valid_param_names = [p['name'] for p in spec['parameters']]

                arguments = []
                for k, v in node['arguments'].items():
                    if k in valid_param_names:
                        arguments.append(Parameter(name=k, value=str(v)))

                t = Task(
                    name=f"node-{node_id}".replace("_", "-").lower(),
                    template_ref=TemplateRef(name=node['template_name'], template=node['entrypoint']),
                    arguments=arguments,

                    env=s3_env_vars     #Jedes task muss s3 credentials wissen
                )
                hera_tasks[node_id] = t

            # ---------------------------------------------------------
            # 2: SCHNITTSTELLE 
            # ---------------------------------------------------------
            for edge in edges:
                source_id = edge['source']
                target_id = edge['target']
                
                src_task = hera_tasks[source_id]
                tgt_task = hera_tasks[target_id]
                
                # Hera Dependency
                src_task >> tgt_task 

                # Target data
                tgt_node_data = next(n for n in nodes if n['id'] == target_id)
                tgt_spec = get_node_spec(tgt_node_data['template_name'], tgt_node_data['entrypoint'])

                # --- Source data ---
                #Outputs source data
                src_node_data = next(n for n in nodes if n['id'] == source_id)
                src_spec = get_node_spec(src_node_data['template_name'], src_node_data['entrypoint'])
                
                # Outputs list
                valid_src_outputs = [o['name'] for o in src_spec['outputs']]

                # Was erwartet target? Iterieren
                for tgt_art in tgt_spec['artifacts']:

                    input_name = tgt_art['name'] 
                    user_selection = tgt_node_data['arguments'].get(input_name)
    
                    # Artifact erzeugen, falls user es selected hat
                    if user_selection and "::" in user_selection:
                        selected_source_id, selected_artifact_name = user_selection.split("::")

                        if selected_source_id == source_id and selected_artifact_name in valid_src_outputs:
                            
                            # A) Filter
                            tgt_task.arguments = [
                                arg for arg in tgt_task.arguments 
                                if not (isinstance(arg, Artifact) and arg.name == input_name)
                            ]

                            # B) Conexion erzeugen
                            tgt_task.arguments.append(
                                Artifact(
                                    name=input_name, 
                                    from_=f"{{{{tasks.{src_task.name}.outputs.artifacts.{selected_artifact_name}}}}}"
                                )
                            )
                    
                    elif user_selection and user_selection in valid_src_outputs:
                         pass
                
            # ---------------------------------------------------------
            # 3: VALIDIERUNG
            # ---------------------------------------------------------
            errors = []
            for node in nodes:
                node_id = node['id']
                t = hera_tasks[node_id]
                spec = get_node_spec(node['template_name'], node['entrypoint'])
                
                # Manuelle Params
                param_values = {
                    arg.name: arg.value 
                    for arg in t.arguments 
                    if isinstance(arg, Parameter) and hasattr(arg, 'value')
                }

                # Verbindete Artifacts (vererbung)
                connected_artifacts = [
                    arg.name 
                    for arg in t.arguments 
                    if isinstance(arg, Artifact) # Si es Artifact, es porque viene de una conexión
                ]

                # --- Parameters Validierung ---
                for p in spec['parameters']:
                    p_name = p['name']
                    
                    if p.get('required', False):
                        # HYBRID
                        
                        has_manual_value = str(param_values.get(p_name, "")).strip() != ""
                        is_connected = p_name in connected_artifacts
                        
                        # sonst error
                        if not has_manual_value and not is_connected:
                             errors.append(f"Knoten '{node['template_name']}': Parameter '{p_name}' fehlt (muss manuell ausgefüllt oder verknüpft werden).")

                # --- Artifacts Validation ---
                for a in spec['artifacts']:
                    a_name = a['name']
                    if a.get('required', False) and a_name not in connected_artifacts:
                         # Nota: Algunos artifacts pueden pasarse como path manual en params, 
                         # así que podrías querer chequear param_values también aquí si tu lógica lo permite.
                         pass 

            if errors:
                raise ValueError("Validierung fehlgeschlagen:\n- " + "\n- ".join(errors))

    if action == "download":
        return w.to_yaml()
    else:
        w.create()
        return w.name