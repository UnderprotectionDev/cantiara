ALTER TABLE "user_flow_version" ADD COLUMN "closed_set" text GENERATED ALWAYS AS (case when jsonb_typeof(document -> 'nodes') = 'array'
        and jsonb_array_length(jsonb_path_query_array(document, '$.nodes[*]')) = jsonb_array_length(jsonb_path_query_array(
          document,
          '$.nodes[*] ? (@.kind == "Screen" || @.kind == "Action" || @.kind == "Decision" || @.kind == "State/Outcome" || @.kind == "Section")'
        ))
        and jsonb_array_length(jsonb_path_query_array(
          document,
          '$.nodes[*] ? (exists(@.style) && @.style != "default" && @.style != "blue" && @.style != "green" && @.style != "amber" && @.style != "red" && @.style != "violet")'
        )) = 0
        then 'valid' else 'invalid' end) STORED;--> statement-breakpoint
ALTER TABLE "user_flow_version" ADD CONSTRAINT "user_flow_version_closed_set_check" CHECK ("user_flow_version"."closed_set" = 'valid');