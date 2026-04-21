import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, { 
  Node, 
  Edge, 
  Connection, 
  addEdge, 
  Background, 
  Controls, 
  Handle, 
  Position,
  NodeProps,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange
} from 'reactflow';
import { useData } from '../../contexts/DataContext';
import { Employee } from '../../types';
import { db, doc, setDoc } from '../../firebase';
import { motion } from 'framer-motion';
import { MapPin, Briefcase, Users, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

// Custom Node for Employee
const EmployeeNode = ({ data }: NodeProps<{ employee: Employee, subordinateCount: number }>) => {
  const { employee, subordinateCount } = data;
  
  return (
    <div className="relative group">
      {/* Top Handle for Parent Connection */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-blue-400 border-2 border-white"
        style={{ top: -6 }}
      />
      
      <motion.div 
        whileHover={{ scale: 1.02 }}
        className={cn(
          "bg-white p-5 rounded-[2rem] border border-gray-100 shadow-lg w-64 flex flex-col items-center text-center transition-all duration-300",
          !employee.managerId ? "border-blue-200 bg-blue-50/20 shadow-blue-100/50" : ""
        )}
      >
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black mb-3 shadow-md",
          !employee.managerId ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
        )}>
          {employee.name?.[0] || '?'}
        </div>
        
        <h4 className="font-black text-gray-900 text-base mb-0.5 truncate w-full">{employee.name}</h4>
        <p className="text-blue-600 font-bold text-xs mb-3 truncate w-full">{employee.jobTitle}</p>
        
        <div className="w-full pt-3 border-t border-gray-50 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 justify-center">
            <MapPin className="w-2.5 h-2.5" />
            <span className="truncate">{employee.location || 'غير محدد'}</span>
          </div>
          {subordinateCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 justify-center mt-1">
              <Users className="w-2.5 h-2.5" />
              <span>{subordinateCount} مرؤوسين</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Bottom Handle for Subordinate Connection */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-blue-600 border-2 border-white"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

const nodeTypes = {
  employee: EmployeeNode,
};

export const OrgChart: React.FC = () => {
  const { employees } = useData();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Update nodes and edges whenever employees data changes
  useEffect(() => {
    // Basic automatic layout logic
    const levelMap: Record<string, number> = {};
    const processed = new Set<string>();
    
    const calculateLevel = (empId: string): number => {
      if (processed.has(empId)) return levelMap[empId];
      const emp = employees.find(e => e.id === empId);
      if (!emp || !emp.managerId || !employees.some(m => m.id === emp.managerId)) {
        levelMap[empId] = 0;
      } else {
        levelMap[empId] = calculateLevel(emp.managerId) + 1;
      }
      processed.add(empId);
      return levelMap[empId];
    };

    employees.forEach(e => calculateLevel(e.id));

    // Group by levels for x positioning
    const levelGroups: Record<number, string[]> = {};
    Object.entries(levelMap).forEach(([id, level]) => {
      if (!levelGroups[level]) levelGroups[level] = [];
      levelGroups[level].push(id);
    });

    const HORIZONTAL_SPACING = 300;
    const VERTICAL_SPACING = 250;

    const initialNodes: Node[] = employees.map(emp => {
      const level = levelMap[emp.id] || 0;
      const indexInLevel = levelGroups[level].indexOf(emp.id);
      const totalInLevel = levelGroups[level].length;
      
      // Center the level groups
      const xOffset = (indexInLevel - (totalInLevel - 1) / 2) * HORIZONTAL_SPACING;

      return {
        id: emp.id,
        type: 'employee',
        position: { x: xOffset, y: level * VERTICAL_SPACING },
        data: { 
          employee: emp,
          subordinateCount: employees.filter(e => e.managerId === emp.id).length
        },
      };
    });

    const initialEdges: Edge[] = employees
      .filter(emp => emp.managerId && employees.some(m => m.id === emp.managerId))
      .map(emp => ({
        id: `e-${emp.managerId}-${emp.id}`,
        source: emp.managerId!,
        target: emp.id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
      }));

    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [employees]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(async (params: Connection) => {
    if (!params.source || !params.target) return;
    if (params.source === params.target) return;

    // Check for circular dependency
    const checkCircular = (targetId: string, sourceId: string): boolean => {
      const parent = employees.find(e => e.id === sourceId);
      if (!parent) return false;
      if (parent.managerId === targetId) return true;
      if (parent.managerId) return checkCircular(targetId, parent.managerId);
      return false;
    };

    if (checkCircular(params.target, params.source)) {
      alert('خطأ: لا يمكن إنشاء علاقة دائرية (الموظف لا يمكن أن يكون مديراً لمديره)');
      return;
    }

    // Update internal state immediately for responsiveness
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 }, type: 'smoothstep' }, eds));

    // PERSIST TO FIRESTORE
    // source = manager, target = subordinate
    try {
      const subordinateId = params.target;
      const managerId = params.source;
      const employee = employees.find(e => e.id === subordinateId);
      if (employee) {
        await setDoc(doc(db, 'employees', subordinateId), {
          ...employee,
          managerId: managerId
        });
      }
    } catch (error) {
      console.error("Error updating manager structure:", error);
      alert('حدث خطأ أثناء تحديث الهيكل التنظيمي');
    }
  }, [employees]);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="text-blue-800 font-bold mb-1">تعليمات التحكم بالهيكل:</p>
          <ul className="text-blue-700 space-y-1 list-disc list-inside">
            <li>قم بسحب الخط من أسفل بطاقة المدير إلى أعلى بطاقة الموظف لتعيين مدير جديد.</li>
            <li>يمكنك تحريك البطاقات لتنظيم الشكل كما تراه مناسباً.</li>
            <li>يتم حفظ التغييرات تلقائياً في ملف الموظف بمجرد التوصيل.</li>
          </ul>
        </div>
      </div>

      <div className="h-[700px] bg-white rounded-[3rem] border border-gray-100 shadow-sm relative overflow-hidden rtl" dir="ltr">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50/30"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};
